import { resolve } from "node:path";
import { avalon } from "@useavalon/avalon";
import { seo } from "@useavalon/seo";
import { defineConfig } from "vite";

export default defineConfig(async () => {
	const avalonPlugins = await avalon({
		core: "preact",
		integrations: ["preact"],
		modules: "app/modules",
		layoutsDir: "app/shared/layouts",

		image: true,
		nitro: {
			preset: process.env.NITRO_PRESET || "node_server",
			streaming: true,
			clientEntry: "app/entry-client",
			globalCSS: ["app/shared/styles/main.css"],
			prerender: {
				routes: ["/", "/about"],
				crawlLinks: true,
				ignore: [],
			},
		},
	});

	return {
		environments: {
			client: {
				build: {
					rollupOptions: {
						input: "./app/entry-client.ts",
					},
				},
			},
			ssr: {
				build: {
					rollupOptions: {
						input: "./server/renderer.ts",
					},
				},
			},
		},

		plugins: [
			seo({
				siteUrl: "http://localhost:3000",
				siteName: "starter",
				defaultDescription: "Built with Avalon",
				defaultOgImage: {
					url: "/og-image.png",
					width: 1200,
					height: 630,
				},
				breadcrumbs: true,
				speakable: true,
			}),
			...avalonPlugins,
		],

		resolve: {
			alias: [
				{ find: "@shared", replacement: resolve("app/shared") },
				{ find: "@modules", replacement: resolve("app/modules") },
				{ find: "@/", replacement: `${resolve("app")}/` },
			],
		},

		build: {
			outDir: "dist",
			emptyOutDir: true,
		},

		server: {
			port: 3000,
		},
	};
});
