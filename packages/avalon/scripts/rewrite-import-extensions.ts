/**
 * Rewrite TypeScript import specifiers to `.js` so a dist-only tarball
 * resolves. Copied `.js` entries (client main, slim) keep `.ts` imports
 * unless this runs on them too.
 */
export function rewriteImportExtensions(code: string): string {
	return code
		.replaceAll(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, "$1$2.js$3")
		.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, "$1$2.js$3")
		.replaceAll(/(import\s+['"])([^'"]+)\.tsx?(['"])/g, "$1$2.js$3");
}
