import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerSsrCssInManifest } from "../copy-ssr-css.ts";
import { runPostBuild } from "../index.ts";
import { addManifestEntries, collectPublicEntries } from "../nitro-manifest.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const PRETTY = `var assets = {
	"/assets/index-abc.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\\"1-a\\"",
		"mtime": "2026-01-01T00:00:00.000Z",
		"size": 1,
		"path": "../public/assets/index-abc.css"
	}
};`;

const COMPACT =
	'var a={"/assets/index-abc.css":{type:`text/css; charset=utf-8`,etag:`"1-a"`,mtime:`2026-01-01T00:00:00.000Z`,size:1,path:`../public/assets/index-abc.css`}};';

function setup(manifest: string): string {
	const cwd = mkdtempSync(join(tmpdir(), "avalon-manifest-"));
	dirs.push(cwd);
	mkdirSync(join(cwd, ".output", "server"), { recursive: true });
	mkdirSync(join(cwd, ".output", "public", "assets"), { recursive: true });
	writeFileSync(join(cwd, ".output", "server", "index.mjs"), manifest);
	const assets = join(cwd, ".output", "public", "assets");
	writeFileSync(join(assets, "ssr-index-abc.css"), "a{color:red}");
	writeFileSync(join(assets, "ssr-index-abc.css.br"), "br");
	writeFileSync(join(assets, "ssr-index-abc.css.gz"), "gz");
	writeFileSync(join(assets, "other.css"), "b{}");
	return cwd;
}

describe("registerSsrCssInManifest", () => {
	it("registers ssr stylesheets and their compressed siblings in a pretty-printed manifest", () => {
		const cwd = setup(PRETTY);
		registerSsrCssInManifest(cwd);
		const code = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		expect(code).toContain('"/assets/ssr-index-abc.css": {');
		expect(code).toContain('"/assets/ssr-index-abc.css.br": {');
		expect(code).toContain('"encoding": "gzip"');
		expect(code).not.toContain("other.css");
		expect(() => new Function(`${code}; return assets;`)).not.toThrow();
		expect(new Function(`${code}; return assets;`)()["/assets/ssr-index-abc.css"].path).toBe(
			"../public/assets/ssr-index-abc.css",
		);
	});

	it("registers them in a compact manifest", () => {
		const cwd = setup(COMPACT);
		registerSsrCssInManifest(cwd);
		const code = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		expect(code).toContain('"/assets/ssr-index-abc.css":{type:`text/css; charset=utf-8`');
		expect(code).toContain("encoding:`br`");
		expect(() => new Function(`${code}; return a;`)).not.toThrow();
	});

	it("is idempotent", () => {
		const cwd = setup(PRETTY);
		registerSsrCssInManifest(cwd);
		const once = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		registerSsrCssInManifest(cwd);
		expect(readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8")).toBe(once);
	});
});

describe("addManifestEntries", () => {
	it("leaves a file without a manifest untouched", () => {
		const cwd = setup("export default 1;");
		const file = join(cwd, ".output", "server", "index.mjs");
		const entries = collectPublicEntries(
			join(cwd, ".output", "public"),
			(n) => n.endsWith(".css"),
			"text/css",
		);
		expect(addManifestEntries(file, entries)).toBe(0);
		expect(readFileSync(file, "utf-8")).toBe("export default 1;");
	});
});

describe("manifest entry paths", () => {
	const NETLIFY =
		'var a={"/assets/index-abc.css":{type:`text/css; charset=utf-8`,etag:`"1-a"`,mtime:`2026-01-01T00:00:00.000Z`,size:1,path:`./public/assets/index-abc.css`}};';

	it("resolves new entries next to the files the manifest already serves", () => {
		const cwd = setup(NETLIFY);
		registerSsrCssInManifest(cwd);
		const code = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		expect(code).toContain("path:`./public/assets/ssr-index-abc.css`");
		expect(code).toContain("path:`./public/assets/ssr-index-abc.css.br`");
		expect(code).not.toContain("../public/assets/ssr-index-abc.css");
	});

	it("uses the pretty-printed manifest's own prefix too", () => {
		const cwd = setup(PRETTY.replaceAll("../public", "../../public"));
		registerSsrCssInManifest(cwd);
		const code = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		expect(code).toContain('"path": "../../public/assets/ssr-index-abc.css"');
	});

	it("falls back to ../public when the anchor entry has no usable path", () => {
		const cwd = setup('var a={"/assets/x.css":{type:`text/css`,etag:`"1"`,size:1}};');
		registerSsrCssInManifest(cwd);
		const code = readFileSync(join(cwd, ".output", "server", "index.mjs"), "utf-8");
		expect(code).toContain("path:`../public/assets/ssr-index-abc.css`");
	});
});

describe("Netlify server bundle", () => {
	const NETLIFY_MANIFEST =
		'var a={"/assets/index-abc.css":{type:`text/css; charset=utf-8`,etag:`"1-a"`,mtime:`2026-01-01T00:00:00.000Z`,size:1,path:`./public/assets/index-abc.css`}};';

	/** A build that only has Netlify output: no `.output` folder at all. */
	function netlifyOnly(): string {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-netlify-"));
		dirs.push(cwd);
		const server = join(cwd, ".netlify", "functions-internal", "server");
		const assets = join(server, "public", "assets");
		mkdirSync(assets, { recursive: true });
		writeFileSync(join(server, "main.mjs"), NETLIFY_MANIFEST);
		// Large enough that compression writes siblings (files under 256 bytes are skipped).
		writeFileSync(join(assets, "ssr-index-abc.css"), `${".a{color:red}".repeat(60)}`);
		return cwd;
	}

	it("registers stylesheets in a Netlify-only build using that bundle's own public folder", () => {
		const cwd = netlifyOnly();
		registerSsrCssInManifest(cwd);
		const main = join(cwd, ".netlify", "functions-internal", "server", "main.mjs");
		expect(readFileSync(main, "utf-8")).toContain("path:`./public/assets/ssr-index-abc.css`");
	});

	it("copies the finished server files to the Netlify v1 paths after compression and registration", async () => {
		const cwd = netlifyOnly();
		await runPostBuild({ cwd, prerender: false });
		const v1 = join(cwd, ".netlify", "v1", "functions", "server");
		const main = readFileSync(join(v1, "main.mjs"), "utf-8");
		// The copy has the registered stylesheet and its compressed siblings, not the earlier snapshot.
		expect(main).toContain('"/assets/ssr-index-abc.css":{type:`text/css; charset=utf-8`');
		expect(main).toContain("encoding:`br`");
		expect(existsSync(join(v1, "public", "assets", "ssr-index-abc.css.br"))).toBe(true);
	});
});
