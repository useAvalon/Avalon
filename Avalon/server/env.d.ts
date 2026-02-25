declare module 'virtual:avalon/config' {
	const config: {
		streaming: boolean;
		pagesDir: string;
		islandsDir: string;
		isDev: boolean;
		[key: string]: unknown;
	};
	export function useAvalonConfig(): typeof config;
	export default config;
}
