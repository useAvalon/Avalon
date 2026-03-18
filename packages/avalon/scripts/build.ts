/**
 * Build script for @useavalon/avalon
 *
 * 1. Compiles all TypeScript source files to minified JavaScript in dist/.
 * 2. Rewrites package.json exports & files to point to dist/ for publishing.
 *    The postpublish hook reverts this via scripts/postpublish.ts.
 *
 * Usage: bun run scripts/build.ts
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
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

async function compileToDistDir() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const allFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, 'mod.ts');
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

			if (file.endsWith('.d.ts')) {
				await writeFile(join(DIST_DIR, rel), code, 'utf-8');
				copied++;
				continue;
			}

			const result = await transform(file, code, {
				sourcemap: false,
				typescript: { onlyRemoveTypeImports: false },
			});

			let output = result.code
				.replace(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, '$1$2.js$3')
				.replace(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, '$1$2.js$3');

			const minified = await minify(file.replace(/\.tsx?$/, '.js'), output);
			output = minified.code;

			const jsName = rel.replace(/\.tsx?$/, '.js');
			await writeFile(join(DIST_DIR, jsName), output, 'utf-8');
			compiled++;
		} else {
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

	const distFiles = await collectFiles(DIST_DIR);
	const totalSize = await Promise.all(distFiles.map(async f => (await readFile(f)).byteLength));
	const total = totalSize.reduce((a, b) => a + b, 0);
	console.log(`✓ dist/ contains ${distFiles.length} files (${(total / 1024).toFixed(1)} kB)`);
}

/**
 * Rewrite package.json so `bun publish` packs dist/ instead of src/.
 * Converts exports from ./mod.ts → ./dist/mod.js, ./src/foo.ts → ./dist/src/foo.js, etc.
 * Also swaps the files field to only include dist/.
 * The original is saved as package.json.bak for postpublish to restore.
 */
async function rewritePackageJsonForPublish() {
	const pkgPath = join(ROOT, 'package.json');
	const raw = await readFile(pkgPath, 'utf-8');
	const pkg = JSON.parse(raw);

	// Guard: if exports already point to dist/, we've already rewritten — skip
	if (pkg.exports?.['.']?.startsWith('./dist/')) {
		console.log('✓ package.json already rewritten for publish, skipping');
		return;
	}

	// Save backup for postpublish restore
	await writeFile(join(ROOT, 'package.json.bak'), raw, 'utf-8');

	// Rewrite exports: .ts/.tsx → dist/ .js, .d.ts stays .d.ts
	if (pkg.exports) {
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (typeof value === 'string') {
				if (value.endsWith('.d.ts')) {
					pkg.exports[key] = `./dist/${value.replace(/^\.\//, '')}`;
				} else {
					pkg.exports[key] = `./dist/${value.replace(/^\.\//, '').replace(/\.tsx?$/, '.js')}`;
				}
			}
		}
	}

	// Rewrite typesVersions
	if (pkg.typesVersions?.['*']) {
		for (const [key, paths] of Object.entries(pkg.typesVersions['*'])) {
			if (Array.isArray(paths)) {
				pkg.typesVersions['*'][key] = paths.map((p: string) => `./dist/${p.replace(/^\.\//, '')}`);
			}
		}
	}

	// Swap files to dist-only
	pkg.files = ['dist/**/*.js', 'dist/**/*.d.ts', 'README.md'];

	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
	console.log('✓ Rewrote package.json exports → dist/ for publish');
}

async function build() {
	await compileToDistDir();
	await rewritePackageJsonForPublish();
}

build().catch(err => {
	console.error('Build failed:', err);
	process.exit(1);
});
