import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVirtualModulesPlugin, RESOLVED_VIRTUAL_IDS } from "../nitro-integration.ts";
import type { ResolvedAvalonConfig } from "../types.ts";

const dirs: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Hook = (this: unknown, ...args: unknown[]) => unknown;

function makePlugin(root: string, avalonConfig: Partial<ResolvedAvalonConfig> = {}) {
	const plugin = createVirtualModulesPlugin({
		avalonConfig: {
			isDev: false,
			layoutsDir: "app/shared/layouts",
			pagesDir: "app/pages",
			modules: null,
			...avalonConfig,
		} as ResolvedAvalonConfig,
		nitroConfig: { clientEntry: "app/entry-client" } as never,
		verbose: false,
	});
	(plugin.configResolved as Hook).call({}, { root });
	return plugin;
}

const client = { environment: { name: "client" } };
const ssr = { environment: { name: "ssr" } };

/** A client build output whose entry is empty or not. */
const bundle = (code: string) => ({
	"assets/entry-client-abc.js": { type: "chunk", isEntry: true, code },
});

async function assetsModule(plugin: ReturnType<typeof makePlugin>): Promise<string> {
	return String(await (plugin.load as Hook).call(ssr, RESOLVED_VIRTUAL_IDS.ASSETS));
}

describe("client entry state", () => {
	it("is passed from the client build to the SSR build of the same project", async () => {
		const plugin = makePlugin("/projects/a");
		(plugin.buildStart as Hook).call(client);
		(plugin.generateBundle as Hook).call(client, {}, bundle(""));
		expect(await assetsModule(plugin)).toContain("const entryIsEmpty = true;");
	});

	it("is not shared between projects built in the same process", async () => {
		const a = makePlugin("/projects/a");
		const b = makePlugin("/projects/b");
		(a.buildStart as Hook).call(client);
		(b.buildStart as Hook).call(client);
		(a.generateBundle as Hook).call(client, {}, bundle(""));
		(b.generateBundle as Hook).call(client, {}, bundle("init()"));
		expect(await assetsModule(a)).toContain("const entryIsEmpty = true;");
		expect(await assetsModule(b)).toContain("const entryIsEmpty = false;");
	});

	it("starts each client build from unknown, so an earlier result is not reused", async () => {
		const plugin = makePlugin("/projects/c");
		(plugin.buildStart as Hook).call(client);
		(plugin.generateBundle as Hook).call(client, {}, bundle(""));
		(plugin.buildStart as Hook).call(client);
		expect(await assetsModule(plugin)).toContain("const entryIsEmpty = false;");
	});

	it("ignores bundles from other environments", async () => {
		const plugin = makePlugin("/projects/d");
		(plugin.buildStart as Hook).call(client);
		(plugin.generateBundle as Hook).call(ssr, {}, bundle(""));
		expect(await assetsModule(plugin)).toContain("const entryIsEmpty = false;");
	});
});

describe("generated layouts module", () => {
	async function layoutsModule(): Promise<string> {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-layouts-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "app", "shared", "layouts"), { recursive: true });
		writeFileSync(
			join(cwd, "app", "shared", "layouts", "_layout.tsx"),
			"export default function L({ children }) { return children; }",
		);
		vi.spyOn(process, "cwd").mockReturnValue(cwd);
		const plugin = makePlugin(cwd);
		return String(await (plugin.load as Hook).call(ssr, RESOLVED_VIRTUAL_IDS.LAYOUTS));
	}

	it("splits the document at a marker that is unique to each call", async () => {
		const code = await layoutsModule();
		expect(code).toContain("function newPageSlot()");
		expect(code).toContain("randomUUID");
		// The old fixed marker could collide with collected head content; it must be gone.
		expect(code).not.toContain("'<!--avalon:page-slot-->'");
	});

	it("checks the marker before and after injection, and fails loudly instead of dropping head content", async () => {
		const code = await layoutsModule();
		const beforeInjection = code.indexOf("const first = html.indexOf(slot);");
		const injection = code.indexOf("const doc = injectUniversalAssets(");
		const afterInjection = code.indexOf("const at = doc.indexOf(slot);");
		expect(beforeInjection).toBeGreaterThan(-1);
		expect(injection).toBeGreaterThan(beforeInjection);
		expect(afterInjection).toBeGreaterThan(injection);
		expect(code).toContain("The page slot was lost while injecting layout assets.");
	});
});
