import { resolve } from "node:path";
import { agentOptimization } from "@useavalon/agent-optimization";
import { avalon } from "@useavalon/avalon";
import { seo } from "@useavalon/seo";
import { defineConfig, type UserConfig } from "vite";
import { quietDevWarningsPlugin } from "./vite-quiet-dev-warnings.ts";

export default defineConfig(async (): Promise<UserConfig> => {
	const avalonPlugins = await avalon({
		// Modular architecture - pages/layouts discovered within each module
		modules: "app/modules",

		// Shared layouts directory (root layout lives here)
		layoutsDir: "app/shared/layouts",

		integrations: ["react", "preact", "vue", "svelte", "qwik", "solid", "lit"],
		lazyIntegrations: true,
		clientRouter: true,

		mdx: {
			jsxImportSource: "preact",
			syntaxHighlighting: true,
		},

		nitro: {
			preset: process.env.NITRO_PRESET || "node_server",
			streaming: true,
			compatibilityDate: "2026-09-04",
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
				"/syntax-highlighting.css": {
					headers: { "Cache-Control": "public, max-age=3600, must-revalidate" },
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
			prerender: {
				crawlLinks: true,
				routes: ["/"],
				ignore: [],
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
			quietDevWarningsPlugin(),
			seo({
				siteUrl: "http://localhost:8012",
				siteName: "Avalon",
				defaultDescription:
					"A multi-framework islands architecture for building fast, modern websites.",
				defaultOgImage: {
					url: "/og-image.png",
					width: 1200,
					height: 630,
				},
				titleSuffix: " — Avalon",
				searchPath: "/search",
				searchQueryParam: "q",
				breadcrumbs: true,
				speakable: true,
				fontPreconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
			}),
			agentOptimization({
				sitemap: {
					siteUrl: "http://localhost:8012",
					changefreq: "daily",
					exclude: ["/admin/**", "/login"],
				},
				markdown: true,
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

		build: {
			outDir: "dist",
			emptyOutDir: true,
			target: "es2020",
			minify: "oxc",
			cssMinify: true,
		},

		server: {
			port: 8012,
			strictPort: false,
			hmr: { port: 8013 },
		},

		resolve: {
			alias: [
				{ find: "@shared", replacement: resolve("app/shared") },
				{ find: "@modules", replacement: resolve("app/modules") },
				{ find: "@/", replacement: `${resolve("app")}/` },
			],
		},
	};
});
