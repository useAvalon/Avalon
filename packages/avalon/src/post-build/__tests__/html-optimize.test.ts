import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { optimizePrerenderedHtml } from "../html-optimize.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("optimizePrerenderedHtml", () => {
	it("defers first-party font and syntax stylesheets", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-html-opt-"));
		dirs.push(cwd);
		const dist = join(cwd, "dist");
		mkdirSync(dist, { recursive: true });
		writeFileSync(
			join(dist, "index.html"),
			`<!DOCTYPE html><html><head><title>t</title>
<link rel="stylesheet" href="/font-faces.css">
<link rel="stylesheet" href="/syntax-highlighting.css">
<link rel="stylesheet" href="/assets/ssr-index-abc.css">
</head><body></body></html>`,
		);
		mkdirSync(join(dist, "assets"), { recursive: true });
		// Exceeds the previous 14_336-byte inline threshold; still under the new 20_480-byte cap.
		writeFileSync(
			join(dist, "assets", "ssr-index-abc.css"),
			`body{color:red}${"x".repeat(14_337 - 15)}`,
		);

		optimizePrerenderedHtml(cwd, dist);
		const html = readFileSync(join(dist, "index.html"), "utf-8");
		expect(html).toContain('href="/font-faces.css" media="print"');
		expect(html).toContain('href="/syntax-highlighting.css" media="print"');
		expect(html).toMatch(/<style data-inlined-from="\/assets\/ssr-index-abc\.css">/);
		expect(html).not.toContain('rel="stylesheet" href="/assets/ssr-index-abc.css"');
	});

	it("drops blocking ssr-index link when CSS exceeds inline threshold", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-html-opt-big-"));
		dirs.push(cwd);
		const dist = join(cwd, "dist");
		mkdirSync(join(dist, "assets"), { recursive: true });
		writeFileSync(
			join(dist, "index.html"),
			`<!DOCTYPE html><html><head><title>t</title>
<link rel="preload" href="/assets/ssr-index-big.css" as="style">
<link rel="stylesheet" href="/assets/ssr-index-big.css">
</head><body></body></html>`,
		);
		writeFileSync(join(dist, "assets", "ssr-index-big.css"), "x".repeat(40_000));

		optimizePrerenderedHtml(cwd, dist);
		const html = readFileSync(join(dist, "index.html"), "utf-8");
		const head = (html.split("</head>")[0] ?? html).replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
		expect(head).not.toContain('rel="stylesheet" href="/assets/ssr-index-big.css"');
		expect(html).toContain("onload=\"this.onload=null;this.rel='stylesheet'\"");
	});
});
