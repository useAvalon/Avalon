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
