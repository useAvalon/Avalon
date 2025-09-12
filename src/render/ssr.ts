import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import type { RenderOptions } from '../schemas/core.ts';

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
}

/**
 * Generate HTML head with Vite integration
 */
function generateHead(options: Partial<RenderOptions>, viteHmrPort?: number): string {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	// Basic meta tags
	const metaTags =
		options.meta?.map(({ name, content }) => `<meta name="${name}" content="${content}">`).join('\n    ') || '';

	// Style tags
	const styleTags = options.styles?.map(href => `<link rel="stylesheet" href="${href}">`).join('\n    ') || '';

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

	// Vite client and island system
	const clientScripts = isDev
		? `
    <script type="module" src="/src/client/main.js"></script>`
		: `
    <script type="module" src="/dist/client.js"></script>`;

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

	return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${metaTags}
      <title>${options.title || 'Avalon App'}</title>
      ${styleTags}
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

		// Merge route options with defaults
		const options = {
			...defaultOptions,
			...routeConfig.options,
		};

		// Generate head with Vite integration
		const head = generateHead(options, viteHmrPort);

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
