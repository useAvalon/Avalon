import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { patchSSRBundleCSS } from "../index.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function setupBundle(cssManifestSnippet: string): { cwd: string; ssrPath: string } {
	const cwd = mkdtempSync(join(tmpdir(), "avalon-css-patch-"));
	dirs.push(cwd);
	const assets = join(cwd, "dist", "assets");
	mkdirSync(assets, { recursive: true });
	writeFileSync(join(assets, "entry-client-abc.css"), "/* entry */");
	writeFileSync(join(assets, "index-xyz.css"), "/* index */");
	writeFileSync(join(assets, "_isolated-island-entry-zzz.css"), "/* skip */");

	const ssrDir = join(cwd, "dist", "_worker.js", "_ssr");
	mkdirSync(ssrDir, { recursive: true });
	const ssrPath = join(ssrDir, "ssr.mjs");
	writeFileSync(
		ssrPath,
		`var __fullstack_assets_manifest_default = { "client": { "app/entry-client.ts": {\n${cssManifestSnippet}\n} } };\n`,
	);
	return { cwd, ssrPath };
}

describe("patchSSRBundleCSS", () => {
	it("appends index-*.css to Rolldown-spaced css arrays", () => {
		const { cwd, ssrPath } = setupBundle(
			`\t"js": [{ "href": "/assets/entry-client-abc.js" }],\n\t"css": [{ "href": "/assets/entry-client-abc.css" }],\n\t"entry": "/assets/entry-client-abc.js"`,
		);

		expect(patchSSRBundleCSS(ssrPath, join(cwd, "dist"), cwd)).toBe(true);
		const out = readFileSync(ssrPath, "utf-8");
		expect(out).toContain('{ "href": "/assets/entry-client-abc.css" }');
		expect(out).toContain('{ "href": "/assets/index-xyz.css" }');
		expect(out).not.toContain("_isolated-island-entry");
	});

	it('still patches legacy compact css:[{href:"…"}] arrays', () => {
		const { cwd, ssrPath } = setupBundle(
			`js:[{href:"/assets/entry-client-abc.js"}],css:[{href:"/assets/entry-client-abc.css"}],entry:"/assets/entry-client-abc.js"`,
		);

		expect(patchSSRBundleCSS(ssrPath, join(cwd, "dist"), cwd)).toBe(true);
		const out = readFileSync(ssrPath, "utf-8");
		expect(out).toContain('{href:"/assets/index-xyz.css"}');
	});
});
