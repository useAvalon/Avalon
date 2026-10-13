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
				"Avalon is a full-stack islands framework: static HTML by default, partial hydration per component, and Nitro-powered deployment to any major JavaScript runtime.",
		},
		{
			question: "How do I get started with Avalon?",
			answer:
				"Run bun create avalon, follow the quick start, and add islands with the island prop when you need interactivity.",
		},
		{
			question: "Why does partial hydration matter?",
			answer:
				"Experts say most marketing pages do not need a full client bundle. Hydrating only islands keeps first load small and improves Core Web Vitals.",
		},
		{
			question: "When should I choose islands over a SPA?",
			answer:
				"When SEO, time-to-first-byte, and static content matter. On the other hand, a SPA can still make sense for highly interactive dashboards — Avalon lets you mix both on one site.",
		},
	],
};
