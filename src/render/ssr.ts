import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import { injectClientScript } from '../functions/inject-client.ts';
import { generateImportMapScript } from '../import_maps.ts';
import { mergeOptions } from '../functions/merge.ts';
import { getHotReloadScript } from '@avalon/hot-reload';
import type { RenderOptions } from '../schemas/core.ts';

export interface RouteConfig {
	component: () => JSX.Element;
	options?: Partial<RenderOptions>;
}

export async function generateHead(
	routeOptions: Partial<RenderOptions> = {},
	defaultOptions: Partial<RenderOptions> = {},
	hasSolidComponents = false, // Simple boolean flag
	hotReloadScript = '' // Add hot reload script parameter
): Promise<string> {
	const inlineScript = `<script async type="module">${injectClientScript()}</script>`;

	// Merge all options with a single function call
	const options = mergeOptions({}, defaultOptions, routeOptions);

	// Generate import map script if options are present
	const importMapScript = options.importMap ? generateImportMapScript(options.importMap) : '';

	// Generate HTML tags
	const metaTags = options.meta
		?.map(({ name, content }) => `<meta name="${name}" content="${content}">`)
		.join('\n    ');

	const scriptTags = options.scripts
		?.map(script => {
			if (typeof script === 'string') {
				// Backward compatibility: simple string URL
				return `<script src="${script}" defer crossorigin="anonymous"></script>`;
			} else {
				// Complex script object
				const attributes: string[] = [];

				// Handle standard HTML attributes
				if (script.src) attributes.push(`src="${script.src}"`);
				if (script.type) attributes.push(`type="${script.type}"`);
				if (script.async) attributes.push('async');
				if (script.defer) attributes.push('defer');
				if (script.crossorigin) attributes.push(`crossorigin="${script.crossorigin}"`);
				if (script.integrity) attributes.push(`integrity="${script.integrity}"`);
				if (script.nomodule) attributes.push('nomodule');
				if (script.referrerpolicy) attributes.push(`referrerpolicy="${script.referrerpolicy}"`);

				// Handle custom attributes
				if (script.attributes) {
					Object.entries(script.attributes).forEach(([key, value]) => {
						if (typeof value === 'string') {
							attributes.push(`${key}="${value}"`);
						}
					});
				}

				const attributeString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';

				if (script.content) {
					// Inline script
					return `<script${attributeString}>${script.content}</script>`;
				} else if (script.data) {
					// Handle structured data (JSON-LD)
					const jsonContent = JSON.stringify(script.data, null, 2);
					const type = script.type || 'application/ld+json';
					return `<script type="${type}">${jsonContent}</script>`;
				} else {
					// External script (src should be defined by schema validation)
					return `<script${attributeString}></script>`;
				}
			}
		})
		.join('\n    ');

	const styleTags = options.styles?.map(href => `<link rel="stylesheet" href="${href}">`).join('\n    ');

	// Only load Solid hydration script if Solid components are present
	let solidHydrationScript = '';
	if (hasSolidComponents) {
		try {
			// Dynamic import to avoid loading Solid when not needed
			const solidWeb = await import('solid-js/web');
			solidHydrationScript = solidWeb.generateHydrationScript();
		} catch (_error) {
			// Solid.js not available, skip hydration script
			console.warn('Solid.js not available, skipping hydration script');
		}
	}

	return `
    <head>
      ${metaTags}
      <title>${options.title}</title>
      ${styleTags}
      ${importMapScript}
      ${scriptTags}
      ${solidHydrationScript}
      ${hotReloadScript}
      ${inlineScript}
    </head>`.trim();
}

export async function renderToHtml(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions> = {},
	hotReloadPort?: number
): Promise<string> {
	try {
		const content = preactRenderToString(routeConfig.component());

		// Simple check: look for Solid-specific patterns in the rendered HTML
		const hasSolidComponents =
			content.includes('solid-js') || content.includes('SolidIsland') || content.includes('createSignal');

		// Generate development scripts first
		const isDev = Deno.env.get('DENO_ENV') !== 'production';
		const hotReloadScript = isDev && hotReloadPort ? getHotReloadScript(hotReloadPort) : '';

		// Generate head with scripts in correct order
		const head = await generateHead(routeConfig.options || {}, defaultOptions, hasSolidComponents, hotReloadScript);

		return `
<!DOCTYPE html>
<html lang="en">
	${head}
	<body>
	${content}
	</body>
</html>`.trim();
	} catch (error) {
		console.error('Error rendering component:', error);
		throw new Error('Failed to render component');
	}
}
