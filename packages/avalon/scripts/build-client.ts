/**
 * Pre-compile client-side TypeScript files to JavaScript.
 *
 * Vite 8's OXC transform applies the global `jsx` config (set by integration
 * plugins like @preact/preset-vite) to ALL files it processes. Plain `.ts`
 * files fail with "Invalid jsx option: 'automatic'". Plugin `transform` hooks
 * don't fire for `node_modules` files on the client side in Vite 8.
 *
 * Solution: ship pre-compiled `.js` files for client code. OXC's default
 * exclude is `/\.js$/`, so these files pass through untouched.
 *
 * Usage: bun run scripts/build-client.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { transform } from 'oxc-transform';

const CLIENT_DIR = join(import.meta.dir, '..', 'src', 'client');

async function collectTSFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'tests' || entry.name === 'types') continue;
			files.push(...(await collectTSFiles(fullPath)));
		} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
			files.push(fullPath);
		}
	}
	return files;
}

function rewriteImportExtensions(code: string): string {
	return code
		.replaceAll(/(from\s+['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3')
		.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.ts(['"]\s*\))/g, '$1$2.js$3')
		.replaceAll(/(import\s+['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3');
}

const tsFiles = await collectTSFiles(CLIENT_DIR);
console.log(`Compiling ${tsFiles.length} client files...`);

for (const file of tsFiles) {
	const code = await readFile(file, 'utf-8');
	const rel = relative(CLIENT_DIR, file);

	const result = await transform(file, code, {
		sourcemap: false,
		typescript: { onlyRemoveTypeImports: false },
	});

	const rewritten = rewriteImportExtensions(result.code);
	const jsPath = file.replace(/\.ts$/, '.js');
	await writeFile(jsPath, rewritten, 'utf-8');

	console.log(`  ✓ ${rel} → ${rel.replace(/\.ts$/, '.js')}`);
}

console.log('Done.');
