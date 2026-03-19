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
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dir, '..');
const SRC_DIR = join(ROOT, 'src');
const DIST_DIR = join(ROOT, 'dist');

const SKIP_DIRS = new Set(['tests', '__tests__', 'node_modules']);

function shouldSkipFile(name: string): boolean {
	return name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name === 'README.md';
}

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(fullPath)));
		} else if (!shouldSkipFile(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

function rewriteImportExtensions(code: string): string {
	return code
		.replaceAll(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, '$1$2.js$3')
		.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, '$1$2.js$3')
		.replaceAll(/(import\s+['"])([^'"]+)\.tsx?(['"])/g, '$1$2.js$3');
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
				...(ext === '.tsx' && {
					jsx: {
						runtime: 'automatic',
						importSource: 'preact',
					},
				}),
			});

			const output = rewriteImportExtensions(result.code);
			const minified = await minify(file.replace(/\.tsx?$/, '.js'), output);
			const jsName = rel.replace(/\.tsx?$/, '.js');
			await writeFile(join(DIST_DIR, jsName), minified.code, 'utf-8');
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

async function rewritePackageJsonForPublish() {
	const pkgPath = join(ROOT, 'package.json');
	const raw = await readFile(pkgPath, 'utf-8');
	const pkg = JSON.parse(raw);

	const mainExport = pkg.exports?.['.'];
	const alreadyRewritten =
		typeof mainExport === 'string'
			? mainExport.startsWith('./dist/')
			: typeof mainExport === 'object' && mainExport?.default?.startsWith('./dist/');

	if (alreadyRewritten) {
		console.log('✓ package.json already rewritten for publish, skipping');
		return;
	}

	await writeFile(join(ROOT, 'package.json.bak'), raw, 'utf-8');

	const toDistPath = (value: string, keepExt = false): string => {
		const stripped = value.replace(/^\.\//, '');
		return keepExt ? `./dist/${stripped}` : `./dist/${stripped.replace(/\.tsx?$/, '.js')}`;
	};

	if (pkg.exports) {
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (typeof value === 'string') {
				if (value.endsWith('.d.ts')) {
					// Pure type export — keep as-is but point to dist
					pkg.exports[key] = toDistPath(value, true);
				} else {
					// Add types + default conditions
					const jsPath = toDistPath(value);
					const dtsPath = jsPath.replace(/\.js$/, '.d.ts');
					pkg.exports[key] = { types: dtsPath, default: jsPath };
				}
			}
		}
	}

	if (pkg.typesVersions?.['*']) {
		for (const [key, paths] of Object.entries(pkg.typesVersions['*'])) {
			if (Array.isArray(paths)) {
				pkg.typesVersions['*'][key] = (paths as string[]).map(p => toDistPath(p, true));
			}
		}
	}

	pkg.files = ['dist/**/*.js', 'dist/**/*.d.ts', 'README.md'];

	await writeFile(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
	console.log('✓ Rewrote package.json exports → dist/ for publish');
}

async function generateDeclarations() {
	const tsconfigBuild = {
		compilerOptions: {
			target: 'ESNext',
			module: 'ESNext',
			moduleResolution: 'bundler',
			declaration: true,
			emitDeclarationOnly: true,
			outDir: './dist',
			rootDir: '.',
			strict: false,
			skipLibCheck: true,
			jsx: 'react-jsx',
			jsxImportSource: 'preact',
			allowArbitraryExtensions: true,
			allowImportingTsExtensions: true,
			paths: {
				'@useavalon/core': ['./node_modules/@useavalon/core'],
			},
		},
		include: ['mod.ts', 'src/**/*.ts', 'src/**/*.tsx'],
		exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/tests/**', 'src/**/__tests__/**'],
	};

	const tsconfigPath = join(ROOT, 'tsconfig.build.json');
	await writeFile(tsconfigPath, JSON.stringify(tsconfigBuild, null, 2), 'utf-8');

	try {
		const tsc = join(ROOT, '..', '..', 'node_modules', '.bin', 'tsc');
		execSync(`"${tsc}" --project tsconfig.build.json`, { cwd: ROOT, stdio: 'inherit' });
		console.log('✓ Generated declaration files');
	} finally {
		await rm(tsconfigPath, { force: true });
	}
}

await compileToDistDir();
await generateDeclarations();
await rewritePackageJsonForPublish();
