import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateServerIslandManifestModule } from "../nitro-integration.ts";

const roots: string[] = [];

function project(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "avalon-si-scan-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		const full = join(root, path);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return root;
}

function manifestPaths(root: string): string[] {
	const code = generateServerIslandManifestModule(root);
	const json = /export const serverIslandManifest = (\{.*\});/.exec(code)?.[1] ?? "{}";
	return Object.values(JSON.parse(json) as Record<string, string>);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("server island manifest scan", () => {
	it("finds a server island used in an MDX page", () => {
		const root = project({
			"app/pages/doc.mdx": `import Clock from '../components/Clock.tsx';\n\n<Clock server={{ timeout: 5000 }} />\n`,
			"app/components/Clock.tsx": "export default () => null;\n",
		});
		expect(manifestPaths(root)).toEqual(["/app/components/Clock.tsx"]);
	});

	it("ignores usage inside code fences and inline code", () => {
		const root = project({
			"app/pages/doc.mdx": [
				"```tsx",
				"import Avatar from '../components/Avatar.tsx';",
				"<Avatar server={{}} />",
				"```",
				"",
				"Use `<Avatar server={{}} />` like this.",
			].join("\n"),
			"app/components/Avatar.tsx": "export default () => null;\n",
		});
		expect(manifestPaths(root)).toEqual([]);
	});

	it("skips an MDX import whose file does not exist", () => {
		const root = project({
			"app/pages/doc.mdx": `import Ghost from '../components/Ghost.tsx';\n\n<Ghost server={{}} />\n`,
		});
		expect(manifestPaths(root)).toEqual([]);
	});

	it("still finds server islands in TSX pages", () => {
		const root = project({
			"app/pages/index.tsx": `import Cart from '../components/Cart.tsx';\nexport default () => <Cart server={{}} />;\n`,
		});
		expect(manifestPaths(root)).toEqual(["/app/components/Cart.tsx"]);
	});
});
