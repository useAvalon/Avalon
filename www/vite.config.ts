import { resolve } from "node:path";
import { agentOptimization } from "@useavalon/agent-optimization";
import { avalon } from "@useavalon/avalon";
import { seo } from "@useavalon/seo";
import { resolveSiteUrl } from "@useavalon/seo/site-config";
import { defineConfig, type UserConfig } from "vite";
import { deployRevision, ssrCacheUntilDeploy } from "./deploy-revision.ts";
import { securityHeaders, securityHeadersWithoutCsp } from "./security-headers.ts";
import { wwwSeoConfig } from "./seo.config.ts";
import { quietDevWarningsPlugin } from "./vite-quiet-dev-warnings.ts";

const isProductionBuild = process.env.NODE_ENV === "production";
const seoSiteUrl = isProductionBuild
	? resolveSiteUrl("https://useavalon.dev")
	: resolveSiteUrl("http://localhost:8012");

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
				// Static assets: cache + non-CSP headers only (CSP comes from Cloudflare `_headers`).
				"/assets/**": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				},
				"/chunks/**": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				},
				"/fonts/**": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				},
				"/islands/**": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=0, must-revalidate",
					},
				},
				"/favicon.ico": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=86400",
					},
				},
				"/font-faces.css": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=86400",
					},
				},
				"/syntax-highlighting.css": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=3600, must-revalidate",
					},
				},
				"/pagefind/**": {
					headers: {
						...securityHeadersWithoutCsp,
						"Cache-Control": "public, max-age=3600, must-revalidate",
					},
				},
				// SSR fallback when a route is not prerendered (www-only; see deploy-revision.ts).
				"/": { headers: securityHeaders, cache: ssrCacheUntilDeploy() },
				"/docs/**": { headers: securityHeaders, cache: ssrCacheUntilDeploy() },
				"/blog/**": { headers: securityHeaders, cache: ssrCacheUntilDeploy() },
				"/demo/**": { headers: securityHeaders, cache: ssrCacheUntilDeploy() },
				"/search/**": { headers: securityHeaders, cache: ssrCacheUntilDeploy() },
				"/api/**": { headers: securityHeaders, cache: false },
				"/_server-islands/**": { headers: securityHeaders, cache: false },
				"/**": {
					headers: securityHeadersWithoutCsp,
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
				// `/404` is copied to `dist/404.html` for Cloudflare Pages (avoids SPA fallback to index.html).
				routes: ["/", "/404"],
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
			seo({ ...wwwSeoConfig, siteUrl: seoSiteUrl }),
			agentOptimization({
				sitemap: {
					siteUrl: seoSiteUrl,
					changefreq: "daily",
					exclude: ["/admin/**", "/login", "/404", "/500"],
				},
				markdown: true,
				llms: {
					siteUrl: seoSiteUrl,
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

		define: {
			__AVALON_DEPLOY_REVISION__: JSON.stringify(deployRevision()),
		},

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
