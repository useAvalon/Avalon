import { describe, expect, it } from "vitest";
import { precompileJsxPlugin } from "../precompile-jsx-plugin.ts";

const SOURCE = "/** @jsxImportSource preact */\nexport default () => <div><p>static</p></div>;";

type Transform = (this: unknown, code: string, id: string) => { code: string } | null;

function run(
	id: string,
	options: Partial<Parameters<typeof precompileJsxPlugin>[0]> = {},
	environment = "ssr",
) {
	const plugin = precompileJsxPlugin({
		enabled: true,
		core: "preact",
		pagesDir: "app/pages",
		layoutsDir: "app/shared/layouts",
		modules: null,
		...options,
	});
	return (plugin.transform as Transform).call({ environment: { name: environment } }, SOURCE, id);
}

describe("precompileJsxPlugin", () => {
	it("precompiles page and layout files in the server build", () => {
		expect(run("/p/app/pages/index.tsx")?.code).toContain("jsxTemplate as");
		expect(run("/p/app/shared/layouts/_layout.tsx")?.code).toContain("jsxTemplate as");
	});

	it("never touches the client build, which cannot render templates", () => {
		expect(run("/p/app/pages/index.tsx", {}, "client")).toBeNull();
	});

	it("leaves files that are not pages or layouts alone, since they may be islands", () => {
		expect(run("/p/app/components/Counter.tsx")).toBeNull();
	});

	it("leaves framework-specific files to their own runtime", () => {
		expect(run("/p/app/pages/Widget.react.tsx")).toBeNull();
		expect(run("/p/app/pages/Widget.solid.tsx")).toBeNull();
		expect(run("/p/app/pages/Widget.preact.tsx")?.code).toContain("jsxTemplate as");
	});

	it("skips query-suffixed ids and non-JSX files", () => {
		expect(run("/p/app/pages/index.tsx?raw")).toBeNull();
		expect(run("/p/app/pages/helper.ts")).toBeNull();
	});

	it("does nothing when disabled or when React renders the shell", () => {
		expect(run("/p/app/pages/index.tsx", { enabled: false })).toBeNull();
		expect(run("/p/app/pages/index.tsx", { core: "react" })).toBeNull();
	});

	it("finds pages and layouts inside modules", () => {
		const modules = { dir: "app/modules", pagesDirName: "pages", layoutsDirName: "layouts" };
		expect(run("/p/app/modules/blog/pages/index.tsx", { modules })?.code).toContain(
			"jsxTemplate as",
		);
	});
});
