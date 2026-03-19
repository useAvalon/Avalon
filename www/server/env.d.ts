declare module 'virtual:avalon/config' {
	const config: {
		streaming: boolean;
		pagesDir: string;
		layoutsDir: string;
		isDev: boolean;
		[key: string]: unknown;
	};
	export function useAvalonConfig(): typeof config;
	export default config;
}

/// <reference types="nitro" />

declare module 'virtual:avalon/page-loader' {
	export function loadPage(pathname: string): Record<string, unknown> | null;
	export default { loadPage: typeof loadPage; routes: unknown[] };
}
