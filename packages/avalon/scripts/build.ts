/**
 * Build script for @useavalon/avalon
 *
 * Compiles all TypeScript source files to minified JavaScript in dist/.
 * Preserves directory structure. Copies .d.ts and .js files as-is.
 * The prepublishOnly hook runs this before npm publish.
 *
 * Usage: bun run scripts/build.ts
 */

import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { transform } from 'oxc-transform';
import { minify } from 'oxc-minify';

const ROOT = join(import.meta.dir, '..');
const SRC_DIR = join(ROOT, 'src');
const DIST_DIR = join(ROOT, 'dist');

const SKIP_DIRS = new Set(['tests', '__tests__', 'node_modules']);
const SKIP_FILES = (name: string) => name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name === 'README.md';

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			files.push(...(await collectFiles(fullPath)));
		} else if (!SKIP_FILES(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

async function build() {
	// Clean dist
	await rm(DIST_DIR, { recursive: true, force: true });

	const allFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, 'mod.ts');

	// Include mod.ts
	const filesToProcess = [modFile, ...allFiles];

	let compiled = 0;
	let copied = 0;

	for (const file of filesToProcess) {
		const rel = file === modFile ? 'mod.ts' : join('src', relative(SRC_DIR, file));
		const ext = extname(file);
		const outDir = join(DIST_DIR, dirname(rel));
		await mkdir(outDir, { recursive: true });

		if (ext === '.ts' || ext === '.tsx') {
			const code = await readFile(file, 'utf-8');

			// .d.ts files — copy as-is
			if (file.endsWith('.d.ts')) {
				await writeFile(join(DIST_DIR, rel), code, 'utf-8');
				copied++;
				continue;
			}

			const result = await transform(file, code, {
				sourcemap: false,
				typescript: { onlyRemoveTypeImports: false },
			});

			// Rewrite .ts/.tsx imports to .js
			let output = result.code
				.replace(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, '$1$2.js$3')
				.replace(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, '$1$2.js$3');

			// Minify the output
			const minified = await minify(file.replace(/\.tsx?$/, '.js'), output);
			output = minified.code;

			const jsName = rel.replace(/\.tsx?$/, '.js');
			await writeFile(join(DIST_DIR, jsName), output, 'utf-8');
			compiled++;
		} else {
			// .js files — minify, others copy as-is
			const code = await readFile(file, 'utf-8');
			if (ext === '.js') {
				const minified = await minify(file, code);
				await writeFile(join(DIST_DIR, rel), minified.code, 'utf-8');
				compiled++;
			} else {
				await writeFile(join(DIST_DIR, rel), code, 'utf-8');
				copied++;
			}
		}
	}

	console.log(`✓ Compiled ${compiled} files, copied ${copied} files to dist/`);

	// Verify output
	const distFiles = await collectFiles(DIST_DIR);
	const totalSize = await Promise.all(distFiles.map(async f => (await readFile(f)).byteLength));
	const total = totalSize.reduce((a, b) => a + b, 0);
	console.log(`✓ dist/ contains ${distFiles.length} files (${(total / 1024).toFixed(1)} kB)`);
}

build().catch(err => {
	console.error('Build failed:', err);
	process.exit(1);
});
