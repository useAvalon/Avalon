/**
 * Shared build script for @useavalon packages.
 *
 * Compiles TypeScript to minified JavaScript in dist/ and rewrites
 * package.json exports & files for dist-only publishing.
 * Run from any package dir: bun run ../../scripts/build-package.ts
 *
 * After publish, run: bun run scripts/postpublish.ts (or the shared one)
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { transform } from 'oxc-transform';
import { minify } from 'oxc-minify';

const ROOT = process.cwd();
const SRC_DIRS = ['src', 'client', 'server']; // scan these if they exist
const DIST_DIR = join(ROOT, 'dist');

const SKIP_DIRS = new Set(['tests', '__tests__', 'node_modules', 'dist']);
const SKIP_FILES = (name: string) =>
	name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name === 'vitest.config.ts' || name === 'tsconfig.json';

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(full)));
			} else if (!SKIP_FILES(entry.name)) {
				files.push(full);
			}
		}
	} catch {}
	return files;
}

async function compileFile(file: string, rel: string): Promise<boolean> {
	const ext = extname(file);
	const outDir = join(DIST_DIR, dirname(rel));
	await mkdir(outDir, { recursive: true });

	if (ext === '.ts' || ext === '.tsx') {
		const code = await readFile(file, 'utf-8');
		if (file.endsWith('.d.ts')) {
			await writeFile(join(DIST_DIR, rel), code, 'utf-8');
			return false;
		}
		const result = await transform(file, code, {
			sourcemap: false,
			typescript: { onlyRemoveTypeImports: false },
		});
		let output = result.code
			.replace(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, '$1$2.js$3')
			.replace(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, '$1$2.js$3');
		const min = await minify(rel.replace(/\.tsx?$/, '.js'), output);
		await writeFile(join(DIST_DIR, rel.replace(/\.tsx?$/, '.js')), min.code, 'utf-8');
		return true;
	}
	if (ext === '.js') {
		const code = await readFile(file, 'utf-8');
		const min = await minify(rel, code);
		await writeFile(join(DIST_DIR, rel), min.code, 'utf-8');
		return true;
	}
	// Copy other files as-is
	const code = await readFile(file, 'utf-8');
	await writeFile(join(DIST_DIR, rel), code, 'utf-8');
	return false;
}

async function build() {
	await rm(DIST_DIR, { recursive: true, force: true });

	// Collect all source files
	const allFiles: Array<{ file: string; rel: string }> = [];

	// Root-level .ts files (mod.ts, types.ts, etc.)
	for (const entry of await readdir(ROOT, { withFileTypes: true })) {
		if (entry.isFile() && /\.tsx?$/.test(entry.name) && !SKIP_FILES(entry.name)) {
			allFiles.push({ file: join(ROOT, entry.name), rel: entry.name });
		}
	}

	// Source directories
	for (const dir of SRC_DIRS) {
		const dirPath = join(ROOT, dir);
		const files = await collectFiles(dirPath);
		for (const f of files) {
			allFiles.push({ file: f, rel: join(dir, relative(dirPath, f)) });
		}
	}

	let compiled = 0;
	for (const { file, rel } of allFiles) {
		if (await compileFile(file, rel)) compiled++;
	}
	console.log(`✓ Compiled ${compiled} files to dist/`);

	// Rewrite package.json
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
				if (value.endsWith('.d.ts')) {
					pkg.exports[key] = `./dist/${value.replace(/^\.\//, '')}`;
				} else {
					pkg.exports[key] = `./dist/${value.replace(/^\.\//, '').replace(/\.tsx?$/, '.js')}`;
				}
			}
		}
	}

	if (pkg.typesVersions?.['*']) {
		for (const [key, paths] of Object.entries(pkg.typesVersions['*'])) {
			if (Array.isArray(paths)) {
				pkg.typesVersions['*'][key] = (paths as string[]).map(p => `./dist/${p.replace(/^\.\//, '')}`);
			}
		}
	}

	pkg.files = ['dist/**/*.js', 'dist/**/*.d.ts', 'README.md'];

	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
	console.log('✓ Rewrote package.json for publish');
}

build().catch(err => {
	console.error('Build failed:', err);
	process.exit(1);
});
