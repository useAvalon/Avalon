import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { minifyCSS } from "./html-optimize.ts";

function patchNitroIndexWithSsrCss(cwd: string, destName: string, size: number): void {
	const nitroIndexPaths = [
		join(cwd, ".output", "server", "index.mjs"),
		join(cwd, ".netlify", "functions-internal", "server", "main.mjs"),
	];
	const assetKey = `/assets/${destName}`;
	const existingCssRe = /"\/assets\/[^"]+\.css":\{type:`text\/css[^}]+\}/;

	for (const indexPath of nitroIndexPaths) {
		if (!existsSync(indexPath)) continue;
		let code = readFileSync(indexPath, "utf-8");
		if (code.includes(assetKey)) continue;
		const match = existingCssRe.exec(code);
		if (!match) continue;

		const mtime = new Date().toISOString();
		const etag = `"${size.toString(16)}-ssr"`;
		const newEntry = `,"${assetKey}":{type:\`text/css; charset=utf-8\`,etag:\`${etag}\`,mtime:\`${mtime}\`,size:${size},path:\`../public/assets/${destName}\`}`;
		code = code.replace(match[0], match[0] + newEntry);
		writeFileSync(indexPath, code);
		console.log(`[ssr-css] ✅ Patched asset manifest in ${indexPath}`);
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
	patchNitroIndexWithSsrCss(cwd, destName, size);
}
