import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { minifyCSS } from "./html-optimize.ts";
import { addManifestEntries, collectPublicEntries, manifestTargets } from "./nitro-manifest.ts";

/**
 * Registers the copied SSR stylesheets (and their pre-compressed siblings) in
 * Nitro's static asset manifest. Nitro snapshots the manifest before
 * post-build runs, so files added afterwards 404 until they are listed.
 * Runs after compression so the `.br` / `.gz` variants exist.
 */
export function registerSsrCssInManifest(cwd: string): void {
	for (const { publicDir, serverEntries } of manifestTargets(cwd)) {
		if (!existsSync(join(publicDir, "assets"))) continue;
		const entries = collectPublicEntries(
			publicDir,
			(name) => name.startsWith("ssr-") && name.endsWith(".css"),
			"text/css; charset=utf-8",
		);
		for (const indexPath of serverEntries) {
			const added = addManifestEntries(indexPath, entries);
			if (added > 0) {
				console.log(`[ssr-css] ✅ Registered ${added} stylesheet file(s) in ${indexPath}`);
			}
		}
	}
}

export function copySSRCSSToClient(cwd: string, distDir: string): void {
	const clientAssets = join(distDir, "assets");
	if (existsSync(clientAssets)) {
		const hasClientCSS = readdirSync(clientAssets).some(
			(f) => f.startsWith("entry-client") && f.endsWith(".css"),
		);
		if (hasClientCSS) {
			console.log("[ssr-css] Skipped — client build already includes entry-client CSS");
			return;
		}
	}

	const ssrAssetsDir = join(cwd, "node_modules", ".nitro", "vite", "services", "ssr", "assets");
	if (!existsSync(ssrAssetsDir)) {
		console.log("[ssr-css] No SSR CSS files found");
		return;
	}

	const cssFiles = readdirSync(ssrAssetsDir).filter((f) => f.endsWith(".css"));
	if (cssFiles.length === 0) {
		console.log("[ssr-css] No SSR CSS files found");
		return;
	}

	const destDirs = [
		join(distDir, "assets"),
		join(cwd, ".output", "public", "assets"),
		join(cwd, ".netlify", "functions-internal", "server", "public", "assets"),
	];
	for (const destDir of destDirs) {
		mkdirSync(destDir, { recursive: true });
		for (const file of cssFiles) {
			let css = readFileSync(join(ssrAssetsDir, file), "utf-8");
			css = minifyCSS(css);
			writeFileSync(join(destDir, `ssr-${file}`), css);
		}
	}

	const sampleFile = cssFiles[0];
	const destName = `ssr-${sampleFile}`;
	const destPath = join(destDirs.find((d) => existsSync(d)) || destDirs[0], destName);
	const size = existsSync(destPath) ? readFileSync(destPath).length : 0;
	console.log(`[ssr-css] Copied SSR CSS → /assets/${destName} (${size} bytes, minified)`);
}
