import type { SeoConfigInput } from "@useavalon/seo";
import { resolveSiteUrl } from "@useavalon/seo/site-config";

const siteUrl = resolveSiteUrl("https://useavalon.dev");

export const wwwSeoConfig: SeoConfigInput = {
	siteUrl,
	siteName: "Avalon",
	defaultDescription: "A multi-framework islands architecture for building fast, modern websites.",
	defaultOgImage: {
		url: "/logo.svg",
		width: 512,
		height: 512,
	},
	titleSuffix: " — Avalon",
	locale: "en_US",
	hreflang: true,
	themeColor: "#0a0a0a",
	appleTouchIcon: "/logo.svg",
	webFontStylesheet: "/font-faces.css",
	contentModified: process.env.AVALON_CONTENT_MODIFIED ?? "2026-10-13T00:00:00.000Z",
	twitterSite: "@useAvalon",
	searchPath: "/search",
	searchQueryParam: "q",
	breadcrumbs: true,
	speakable: true,
	webAppManifest: "/manifest.webmanifest",
	feedUrl: "/blog/feed.xml",
	publisher: {
		name: "Avalon",
		url: siteUrl,
		logo: { url: "/logo.svg", width: 512, height: 512 },
		sameAs: [
			"https://github.com/useAvalon/Avalon",
			"https://x.com/useAvalon",
			"https://discord.gg/avalon",
		],
	},
	faq: [
		{
			question: "What is Avalon?",
			answer:
				"Avalon is a full-stack JavaScript framework built around islands architecture and partial hydration. Pages render as HTML on the server, interactive components hydrate as islands, and deployment runs through Nitro to supported runtimes.",
		},
		{
			question: "How do I get started with Avalon?",
			answer:
				"Run bun create avalon, follow the quick start, and add islands with the island prop when you need interactivity.",
		},
		{
			question: "Why does partial hydration matter?",
			answer:
				"Most marketing and content pages need little or no client-side JavaScript. Hydrating only islands limits what ships to the browser and can improve Core Web Vitals compared with hydrating the entire page.",
		},
		{
			question: "When should I use islands?",
			answer:
				"When only some of the page needs to be interactive. Mark those components as islands and the rest stays HTML, with no client JavaScript.",
		},
	],
};
