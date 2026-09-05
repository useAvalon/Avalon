import { beforeEach, describe, expect, it } from "vitest";
import { clearManifest, getManifest } from "../../server-islands/manifest.ts";
import { serverIslandsPlugin } from "../server-islands-plugin.ts";

/**
 * Helper to invoke the transform hook of the plugin with a simulated Vite context.
 */
function createPluginInstance() {
	const plugin = serverIslandsPlugin({ verbose: false });

	// Simulate config (initializes AVALON_KEY, as in production)
	if (typeof plugin.config === "function") {
		(plugin.config as Function)({}, { command: "serve", mode: "development" });
	}

	// Simulate configResolved
	if (typeof plugin.configResolved === "function") {
		(plugin.configResolved as Function)({ root: "/project" });
	}

	// Simulate buildStart
	if (typeof plugin.buildStart === "function") {
		(plugin.buildStart as Function).call({});
	}

	return plugin;
}

function callTransform(plugin: ReturnType<typeof serverIslandsPlugin>, code: string, id: string) {
	if (typeof plugin.transform === "function") {
		return (plugin.transform as Function).call({}, code, id);
	}
	return null;
}

function callResolveId(plugin: ReturnType<typeof serverIslandsPlugin>, id: string) {
	if (typeof plugin.resolveId === "function") {
		return (plugin.resolveId as Function).call({}, id);
	}
	return null;
}

function callLoad(plugin: ReturnType<typeof serverIslandsPlugin>, id: string) {
	if (typeof plugin.load === "function") {
		return (plugin.load as Function).call({}, id);
	}
	return null;
}

describe("serverIslandsPlugin", () => {
	beforeEach(() => {
		clearManifest();
	});

	describe("server prop detection", () => {
		it("detects server prop with object expression", () => {
			const plugin = createPluginInstance();
			const code = `
import UserAvatar from "../components/UserAvatar.tsx";

export default function Page() {
  return <UserAvatar server={{ fallback: <div>Loading...</div> }} userId={1} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(1);
			// The component should be registered with its resolved path
			expect(Object.values(manifest)[0]).toContain("components/UserAvatar.tsx");
		});

		it("detects server prop with variable reference", () => {
			const plugin = createPluginInstance();
			const code = `
import NotificationBell from "@/shared/components/NotificationBell.tsx";

const serverOpts = { fallback: <span>...</span> };

export default function Page() {
  return <NotificationBell server={serverOpts} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/dashboard.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(1);
			expect(Object.values(manifest)[0]).toBe("/app/shared/components/NotificationBell.tsx");
		});

		it("detects boolean server prop", () => {
			const plugin = createPluginInstance();
			const code = `
import Widget from "~/components/Widget.tsx";

export default function Page() {
  return <Widget server />;
}
`;
			callTransform(plugin, code, "/project/src/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(1);
			expect(Object.values(manifest)[0]).toBe("/src/components/Widget.tsx");
		});

		it("detects multiple server island components in one file", () => {
			const plugin = createPluginInstance();
			const code = `
import UserAvatar from "@/shared/components/UserAvatar.tsx";
import CartCount from "@/shared/components/CartCount.tsx";

export default function Page() {
  return (
    <div>
      <UserAvatar server={{ fallback: <div /> }} userId={1} />
      <CartCount server={{ fallback: <span>0</span> }} />
    </div>
  );
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(2);
		});

		it("ignores components without server prop", () => {
			const plugin = createPluginInstance();
			const code = `
import Header from "../components/Header.tsx";
import Footer from "../components/Footer.tsx";

export default function Page() {
  return (
    <div>
      <Header title="Hello" />
      <Footer />
    </div>
  );
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(0);
		});

		it("ignores non-TSX/JSX files", () => {
			const plugin = createPluginInstance();
			const code = `const server = { key: "value" };`;

			callTransform(plugin, code, "/project/src/utils/config.ts");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(0);
		});

		it("ignores node_modules files", () => {
			const plugin = createPluginInstance();
			const code = `
import Component from "./Component.tsx";
export default function Page() {
  return <Component server={{ fallback: <div /> }} />;
}
`;
			callTransform(plugin, code, "/project/node_modules/some-lib/index.tsx");

			const manifest = getManifest();
			expect(Object.keys(manifest)).toHaveLength(0);
		});
	});

	describe("path resolution", () => {
		it("resolves @/ alias to /app/", () => {
			const plugin = createPluginInstance();
			const code = `
import Avatar from "@/components/Avatar.tsx";
export default function Page() {
  return <Avatar server={{ fallback: <div /> }} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.values(manifest)[0]).toBe("/app/components/Avatar.tsx");
		});

		it("resolves ~/ alias to /src/", () => {
			const plugin = createPluginInstance();
			const code = `
import Widget from "~/islands/Widget.tsx";
export default function Page() {
  return <Widget server={{ fallback: <span /> }} />;
}
`;
			callTransform(plugin, code, "/project/src/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.values(manifest)[0]).toBe("/src/islands/Widget.tsx");
		});

		it("resolves relative imports", () => {
			const plugin = createPluginInstance();
			const code = `
import Counter from "../components/Counter.tsx";
export default function Page() {
  return <Counter server={{ fallback: <div>0</div> }} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			expect(Object.values(manifest)[0]).toBe("/app/components/Counter.tsx");
		});
	});

	describe("virtual modules", () => {
		it("resolves virtual:server-island-manifest", () => {
			const plugin = createPluginInstance();
			const resolved = callResolveId(plugin, "virtual:server-island-manifest");
			expect(resolved).toBe("\0virtual:server-island-manifest");
		});

		it("resolves virtual:server-island-key", () => {
			const plugin = createPluginInstance();
			const resolved = callResolveId(plugin, "virtual:server-island-key");
			expect(resolved).toBe("\0virtual:server-island-key");
		});

		it("returns null for unknown ids", () => {
			const plugin = createPluginInstance();
			const resolved = callResolveId(plugin, "some-other-module");
			expect(resolved).toBeNull();
		});

		it("does not intercept virtual:server-island-integrations (Nitro owns it)", () => {
			const plugin = createPluginInstance();
			expect(callResolveId(plugin, "virtual:server-island-integrations")).toBeNull();
			expect(callLoad(plugin, "\0virtual:server-island-integrations")).toBeNull();
		});

		it("loads manifest virtual module with registered components", () => {
			const plugin = createPluginInstance();

			// Register a component via transform
			const code = `
import UserAvatar from "@/components/UserAvatar.tsx";
export default function Page() {
  return <UserAvatar server={{ fallback: <div /> }} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const result = callLoad(plugin, "\0virtual:server-island-manifest");
			expect(result).toContain("export const serverIslandManifest");
			expect(result).toContain("/app/components/UserAvatar.tsx");
		});

		it("loads key virtual module with encryption key", () => {
			const plugin = createPluginInstance();
			const result = callLoad(plugin, "\0virtual:server-island-key");
			expect(result).toContain("export const serverIslandKey");
			// Key should be a non-empty base64 string
			expect(result).toMatch(/serverIslandKey = "[A-Za-z0-9+/=]+"/);
		});

		it("returns null for unknown load ids", () => {
			const plugin = createPluginInstance();
			const result = callLoad(plugin, "some-other-id");
			expect(result).toBeNull();
		});
	});

	describe("component ID generation", () => {
		it("generates stable IDs for the same path", () => {
			const plugin = createPluginInstance();
			const code = `
import Avatar from "@/components/Avatar.tsx";
export default function Page() {
  return <Avatar server={{ fallback: <div /> }} />;
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");
			const manifest1 = { ...getManifest() };

			// Clear and re-register
			clearManifest();
			callTransform(plugin, code, "/project/app/pages/index.tsx");
			const manifest2 = getManifest();

			expect(Object.keys(manifest1)[0]).toBe(Object.keys(manifest2)[0]);
		});

		it("generates different IDs for different paths", () => {
			const plugin = createPluginInstance();
			const code = `
import Avatar from "@/components/Avatar.tsx";
import Badge from "@/components/Badge.tsx";
export default function Page() {
  return (
    <div>
      <Avatar server={{ fallback: <div /> }} />
      <Badge server={{ fallback: <span /> }} />
    </div>
  );
}
`;
			callTransform(plugin, code, "/project/app/pages/index.tsx");

			const manifest = getManifest();
			const ids = Object.keys(manifest);
			expect(ids).toHaveLength(2);
			expect(ids[0]).not.toBe(ids[1]);
		});
	});
});
