import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import type { RenderOptions } from '../schemas/core.ts';
import { getSvelteSSRCSS } from '../islands/island.tsx';

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
}

/**
 * Generate HTML head with Vite integration and proper Solid.js hydration support
 */
async function generateHead(
	options: Partial<RenderOptions>,
	viteHmrPort?: number,
	hasSolidComponents = false,
	_hasVueComponents = false,
	hasSvelteComponents = false
): Promise<string> {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	// Basic meta tags
	const metaTags =
		options.meta?.map(({ name, content }) => `<meta name="${name}" content="${content}">`).join('\n    ') || '';

	// Style tags
	const styleTags = options.styles?.map(href => `<link rel="stylesheet" href="${href}">`).join('\n    ') || '';

	// Collect and inject Svelte SSR CSS
	const svelteSSRCSS = getSvelteSSRCSS(true); // Get and clear the collected CSS
	const svelteStyleTags = svelteSSRCSS ? `\n    ${svelteSSRCSS}` : '';

	// Script tags (for additional scripts)
	const scriptTags =
		options.scripts
			?.map(script => {
				if (typeof script === 'string') {
					return `<script src="${script}" defer></script>`;
				}
				// Handle complex script objects if needed
				const attrs = script.src ? `src="${script.src}"` : '';
				const type = script.type ? `type="${script.type}"` : '';
				const content = script.content || '';
				return `<script ${attrs} ${type}>${content}</script>`;
			})
			.join('\n    ') || '';

	// Official Solid.js hydration script - only load if Solid components are present
	let solidHydrationScript = '';
	if (hasSolidComponents) {
		try {
			// Dynamic import to avoid loading Solid when not needed
			const solidWeb = await import('solid-js/web');
			if (solidWeb.generateHydrationScript) {
				solidHydrationScript = `
    ${solidWeb.generateHydrationScript()}`;
			}
		} catch (_error) {
			// Solid.js not available, skip hydration script
			console.warn('Solid.js not available, skipping hydration script');
		}
	}

	// Vite client and island system
	const clientScripts = isDev
		? `
    <script type="module" src="/src/client/main.js"></script>
    ${hasSolidComponents ? '<script type="module" src="/src/client/solid-hydration.js"></script>' : ''}
    ${hasSvelteComponents ? '<!-- Svelte components now use self-contained hydration -->' : ''}`
		: `
    <script type="module" src="/dist/client.js"></script>
    ${hasSolidComponents ? '<script type="module" src="/dist/solid-hydration.js"></script>' : ''}
    ${hasSvelteComponents ? '<!-- Svelte components now use self-contained hydration -->' : ''}`;

	// HMR WebSocket for development
	const hmrScript =
		isDev && viteHmrPort
			? `
    <script type="module">
      if (import.meta.hot) {
        import.meta.hot.accept();
      }
    </script>`
			: '';

	// Import map for framework dependencies - let Vite handle all module resolution
	const importMap = ''; // Always let Vite handle module resolution

	return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${metaTags}
      <title>${options.title || 'Avalon App'}</title>
      ${importMap}
      ${solidHydrationScript}
      ${styleTags}${svelteStyleTags}
      ${scriptTags}${clientScripts}${hmrScript}
    </head>`.trim();
}

/**
 * Simplified SSR rendering with Vite integration
 * No more complex framework detection - islands handle their own hydration
 */
export async function renderToHtml(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number
): Promise<string> {
	try {
		// Render the main component to HTML (handle both sync and async components)
		const componentResult = routeConfig.component();
		const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
		const content = preactRenderToString(resolvedComponent);

		// Simple check: look for Solid-specific patterns in the rendered HTML
		const hasSolidComponents =
			content.includes('solid-js') ||
			content.includes('SolidIsland') ||
			content.includes('createSignal') ||
			content.includes('.solid.') ||
			(content.includes('data-hydrate') && content.includes('Solid'));

		// Simple check: look for Vue-specific patterns in the rendered HTML
		const hasVueComponents =
			content.includes('data-vue-hydrate') || content.includes('.vue') || content.includes('Vue');

		// Simple check: look for Svelte-specific patterns in the rendered HTML
		const hasSvelteComponents =
			content.includes('data-framework="svelte"') || content.includes('.svelte') || content.includes('s-');

		// Merge route options with defaults
		const options = {
			...defaultOptions,
			...routeConfig.options,
		};

		// Generate head with Vite integration and framework detection
		const head = await generateHead(options, viteHmrPort, hasSolidComponents, hasVueComponents, hasSvelteComponents);

		return `<!DOCTYPE html>
<html lang="en">
${head}
<body>
${content}
</body>
</html>`;
	} catch (error) {
		console.error('Error rendering component:', error);
		throw new Error('Failed to render component');
	}
}
