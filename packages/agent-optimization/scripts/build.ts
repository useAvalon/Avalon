/**
 * Build script for @useavalon/agent-optimization
 *
 * 1. Compiles TypeScript to minified JavaScript in dist/.
 * 2. Rewrites package.json exports & files for dist-only publishing.
 *    Run scripts/postpublish.ts after publish to restore.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { transform } from 'oxc-transform';
import { minify } from 'oxc-minify';

const ROOT = join(import.meta.dir, '..');
const SRC_DIR = join(ROOT, 'src');
const DIST_DIR = join(ROOT, 'dist');

const SKIP_DIRS = new Set(['__tests__', 'node_modules']);
const SKIP_FILES = (name: string) => name.endsWith('.test.ts');

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(full)));
		} else if (!SKIP_FILES(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

async function build() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const srcFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, 'mod.ts');
	let compiled = 0;

	for (const file of [modFile, ...srcFiles]) {
		const rel = file === modFile ? 'mod.ts' : join('src', relative(SRC_DIR, file));
		const ext = extname(file);
		await mkdir(join(DIST_DIR, dirname(rel)), { recursive: true });

		if (ext === '.ts') {
			const code = await readFile(file, 'utf-8');
			if (file.endsWith('.d.ts')) {
				await writeFile(join(DIST_DIR, rel), code, 'utf-8');
				continue;
			}
			const result = await transform(file, code, {
				sourcemap: false,
				typescript: { onlyRemoveTypeImports: false },
			});
			let output = result.code
				.replaceAll(/(from\s+['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3')
				.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.ts(['"]\s*\))/g, '$1$2.js$3')
				.replaceAll(/(import\s+['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3');
			const min = await minify(rel.replace(/\.ts$/, '.js'), output);
			await writeFile(join(DIST_DIR, rel.replace(/\.ts$/, '.js')), min.code, 'utf-8');
			compiled++;
		}
	}

	console.log(`✓ Compiled ${compiled} files to dist/`);

	// Rewrite package.json for publish
	const pkgPath = join(ROOT, 'package.json');
	const raw = await readFile(pkgPath, 'utf-8');
	const pkg = JSON.parse(raw);

	if (pkg.exports?.['.']?.startsWith('./dist/')) {
		console.log('✓ package.json already rewritten, skipping');
		return;
	}

	await writeFile(join(ROOT, 'package.json.bak'), raw, 'utf-8');

	if (pkg.exports) {
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (typeof value === 'string') {
				pkg.exports[key] = `./dist/${value.replace(/^\.\//, '').replace(/\.ts$/, '.js')}`;
			}
		}
	}
	pkg.files = ['dist/**/*.js', 'dist/**/*.d.ts', 'README.md'];

	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
	console.log('✓ Rewrote package.json for publish');
}

await build();
