import { createRequire } from "node:module";
import { resolve } from "node:path";
import { agentOptimization } from "@useavalon/agent-optimization";
import { avalon } from "@useavalon/avalon";
import { defineConfig, type UserConfig } from "vite";

const require = createRequire(import.meta.url);

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const avalonPlugins = await avalon({
		// Modular architecture - pages/layouts discovered within each module
		modules: "app/modules",

		// Shared layouts directory (root layout lives here)
		layoutsDir: "app/shared/layouts",

		integrations: ["react", "preact", "vue", "svelte", "qwik", "solid", "lit"],
		lazyIntegrations: true,

		mdx: {
			jsxImportSource: "preact",
			syntaxHighlighting: true,
		},

		nitro: {
			preset: process.env.NITRO_PRESET || "node_server",
			streaming: true,
			compatibilityDate: "2025-06-01",
			clientEntry: "app/entry-client",
			globalCSS: ["app/shared/styles/main.css"],
			routeRules: {
				"/assets/**": {
					headers: { "Cache-Control": "public, max-age=31536000, immutable" },
				},
				"/chunks/**": {
					headers: { "Cache-Control": "public, max-age=31536000, immutable" },
				},
				"/favicon.ico": {
					headers: { "Cache-Control": "public, max-age=86400" },
				},
			},
			runtimeConfig: {
				appName: "Avalon Demo",
				appVersion: "1.0.0",
			},
			staticAssets: {
				publicDir: "public",
				buildDir: "dist",
				compression: true,
			},

			// Prerender static pages at build time (SSG).
			// Nitro fetches each route using the SSR handler, writes the
			// resulting HTML (including island markup) to static files.
			// Islands still hydrate on the client as normal.
			// Only /demo/data-fetching stays SSR (it fetches live data).
			prerender: {
				crawlLinks: true,
				routes: ["/", "/demo"],
				ignore: ["/demo/data-fetching"],
				failOnError: true,
			},
		},

		autoDiscoverIntegrations: true,
		verbose: false,
		showWarnings: false,
		image: true,
	});

	return {
		root: ".",
		publicDir: "public",

		// Nitro uses server/renderer.ts as the SSR entry.
		// The client environment uses entry-client.ts so Vite bundles
		// the island hydration runtime. The SSR entry references these
		// assets via the ?assets=client virtual import.
		environments: {
			client: {
				build: {
					rollupOptions: {
						input: "./app/entry-client.ts",
					},
				},
			},
			// Explicit SSR environment — ensures Nitro's configEnvironment
			// hook registers the SSR service and the internal ssr-renderer
			// is wired into the catch-all route.
			ssr: {
				build: {
					rollupOptions: {
						input: "./server/renderer.ts",
					},
				},
			},
		},

		plugins: [
			// Resolve preact/compat bare specifiers to absolute paths.
			// @preact/preset-vite rewrites react → preact/compat as bare strings
			// which Rolldown can't resolve. This plugin catches them early.
			{
				name: "avalon:preact-compat-resolver",
				enforce: "pre" as const,
				resolveId(id: string) {
					if (id === "preact") return require.resolve("preact");
					if (id === "preact/hooks") return require.resolve("preact/hooks");
					if (id === "preact/compat") return require.resolve("preact/compat");
					if (id === "preact/compat/server") return require.resolve("preact/compat/server");
					if (id === "preact/compat/client") return require.resolve("preact/compat/client");
				},
			},
			// Stub out build-time Vite plugins during SSR/Nitro builds.
			// Integration vitePlugin() methods dynamically import these packages,
			// but they're never called at SSR runtime. Without stubbing, the
			// bundler pulls in vite → rolldown → native bindings, which crash
			// at runtime with "Cannot find native binding".
			{
				name: "avalon:stub-build-time-plugins",
				enforce: "pre" as const,
				resolveId(id: string) {
					// @ts-expect-error — Vite 8 environment API
					const env = this.environment?.name;
					if (env !== "ssr" && env !== "nitro") return;
					const buildTimePackages = [
						"@preact/preset-vite",
						"@vitejs/plugin-react",
						"@vitejs/plugin-vue",
						"@sveltejs/vite-plugin-svelte",
						"vite-plugin-solid",
						"@builder.io/qwik/optimizer",
						"vite-prerender-plugin",
					];
					if (buildTimePackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))) {
						return `\0stub:${id}`;
					}
				},
				load(id: string) {
					if (id.startsWith("\0stub:")) {
						return "export default function() { return []; }; export {};";
					}
				},
			},
			agentOptimization({
				sitemap: {
					siteUrl: "http://localhost:8012",
					changefreq: "daily",
					exclude: ["/admin/**", "/login"],
				},
				markdown: true,
				structuredData: true,
				llms: {
					siteUrl: "http://localhost:8012",
					siteName: "Avalon",
					siteDescription:
						"A multi-framework islands architecture for building fast, modern websites.",
					sections: {
						Pages: ["/"],
						Docs: ["/docs"],
						Blog: ["/blog"],
					},
					exclude: ["/admin/**"],
					full: true,
				},
			}),
			avalonPlugins,
		].flat(),

		optimizeDeps: {
			include: [
				"react",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"react-dom",
				"react-dom/client",
				"vue",
				"svelte",
				"svelte/internal",
				"svelte/store",
				"lit",
				"@lit-labs/ssr-client",
				"@lit-labs/ssr-client/lit-element-hydrate-support.js",
				"preact",
				"preact/hooks",
				"preact/jsx-runtime",
				"@builder.io/qwik",
			],
		},

		build: {
			outDir: "dist",
			emptyOutDir: true,
			target: "es2020",
			minify: "oxc",
		},

		server: {
			port: 8012,
			strictPort: false,
			hmr: { port: 8013 },
		},

		ssr: {
			target: "webworker",
			resolve: {
				// 'node' condition ensures solid-js/web resolves to server.js (SSR build)
				// instead of dev.js (client DOM build). Vue's CJS issue from its "node"
				// condition is handled by the resolve.alias for vue below.
				conditions: ["node"],
			},
			noExternal: [
				"vue",
				"@vue/server-renderer",
				"@vue/shared",
				"svelte",
				"svelte/internal",
				"svelte/store",
				"svelte/server",
				"react",
				"react-dom",
				"react-dom/client",
				"react-dom/server",
				"preact",
				"preact/hooks",
				"preact/compat",
				"preact/compat/server",
				"preact-render-to-string",
				"@builder.io/qwik",
				"@builder.io/qwik/server",
				// estree-walker v3 is ESM-only (no CJS "require" export).
				// Vue's compiler-sfc uses it, and without inlining it the
				// Nitro server bundle emits a require('estree-walker') that
				// fails at runtime with ERR_PACKAGE_PATH_NOT_EXPORTED.
				"estree-walker",
			],
			// solid-js and solid-js/web are intentionally NOT in noExternal.
			// They must load as native ESM so the renderer and component share
			// the same module instance (and thus the same sharedConfig).
			// The resolveId hook in avalon:solid-oxc-exclude already ensures
			// they resolve to server.js in SSR and dev.js on the client.
		},

		resolve: {
			alias: [
				{ find: "@shared", replacement: resolve("app/shared") },
				{ find: "@modules", replacement: resolve("app/modules") },
				{ find: "@/", replacement: `${resolve("app")}/` },
				// React → Preact compat aliases with absolute paths.
				// @preact/preset-vite adds these as bare specifiers which Rolldown
				// can't resolve. Providing absolute paths fixes the SSR build.
				{ find: /^react$/, replacement: require.resolve("preact/compat") },
				{ find: /^react\/jsx-runtime$/, replacement: require.resolve("preact/jsx-runtime") },
				{ find: /^react\/jsx-dev-runtime$/, replacement: require.resolve("preact/jsx-runtime") },
				{ find: /^react-dom$/, replacement: require.resolve("preact/compat") },
				{ find: /^react-dom\/server$/, replacement: require.resolve("preact/compat/server") },
				{ find: /^react-dom\/client$/, replacement: require.resolve("preact/compat/client") },
				// Pin preact core + hooks to absolute paths so every import
				// (direct, via compat, via jsx-runtime) resolves to the same
				// instance. Without this, the bundler can pull in two copies
				// of preact and hooks never register __H on the right one.
				{ find: /^preact$/, replacement: require.resolve("preact") },
				{ find: /^preact\/hooks$/, replacement: require.resolve("preact/hooks") },
				{ find: /^preact\/compat$/, replacement: require.resolve("preact/compat") },
				{ find: /^preact\/compat\/server$/, replacement: require.resolve("preact/compat/server") },
				{ find: /^preact\/compat\/client$/, replacement: require.resolve("preact/compat/client") },
				{ find: /^vue$/, replacement: "vue/dist/vue.esm-bundler.js" },
				{ find: /^@vue\/shared$/, replacement: "@vue/shared/dist/shared.esm-bundler.js" },
				{
					find: /^@vue\/runtime-core$/,
					replacement: "@vue/runtime-core/dist/runtime-core.esm-bundler.js",
				},
				{
					find: /^@vue\/runtime-dom$/,
					replacement: "@vue/runtime-dom/dist/runtime-dom.esm-bundler.js",
				},
				{
					find: /^@vue\/reactivity$/,
					replacement: "@vue/reactivity/dist/reactivity.esm-bundler.js",
				},
				{
					find: /^@vue\/server-renderer$/,
					replacement: "@vue/server-renderer/dist/server-renderer.esm-bundler.js",
				},
			],
		},

		define: {
			__DEV__: command === "serve",
			__PROD__: command === "build",
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: command === "serve",
			global: "globalThis",
			"process.env.NODE_ENV": JSON.stringify(command === "serve" ? "development" : "production"),
		},
	};
});
