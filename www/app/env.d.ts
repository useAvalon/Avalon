/// <reference types="@useavalon/avalon/types/island-jsx" />

// Treat cross-framework island files as Preact-compatible function components.
// The Avalon Vite transform handles these at build time — these declarations
// are purely for TypeScript's benefit so the `island` prop and component props
// work without manual casting.
declare module '*.vue' {
	import type { ComponentType } from 'preact';
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}

declare module '*.svelte' {
	import type { ComponentType } from 'preact';
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}

declare module '*.solid.tsx' {
	import type { ComponentType } from 'preact';
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}

declare module '*.lit.ts' {
	import type { ComponentType } from 'preact';
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}

declare module '*.qwik.tsx' {
	import type { ComponentType } from 'preact';
	const component: ComponentType<Record<string, unknown>>;
	export default component;
}

declare module '*.module.css' {
	const classes: Record<string, string>;
	export default classes;
}

// Nitro virtual asset manifests (resolved at build time by Nitro's Vite plugin)
declare module '*?assets=client' {
	const assets: {
		css: Array<{ href: string; [key: string]: string }>;
		js: Array<{ href: string; [key: string]: string }>;
		entry: string;
	};
	export default assets;
}

declare module '*?assets=ssr' {
	const assets: {
		css: Array<{ href: string; [key: string]: string }>;
		js: Array<{ href: string; [key: string]: string }>;
		entry: string;
	};
	export default assets;
}

// Avalon virtual modules (resolved at build time by Avalon's Vite plugin)
declare module 'virtual:avalon/page-loader' {
	export function loadPage(pathname: string): { default: unknown; metadata?: Record<string, unknown> } | null;
}

declare module 'virtual:avalon/config' {
	const config: {
		streaming: boolean;
		pagesDir: string;
		layoutsDir: string;
		isDev: boolean;
		[key: string]: unknown;
	};
	export default config;
}
