import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import type { RenderOptions } from '../schemas/core.ts';
import { getSvelteSSRCSS } from '../islands/island.tsx';

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
}

interface FrameworkDetection {
	solid: boolean;
	vue: boolean;
	svelte: boolean;
}

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
	solid: ['solid-js', 'SolidIsland', 'createSignal', '.solid.', 'data-hydrate'],
	vue: ['data-vue-hydrate', '.vue', 'Vue'],
	svelte: ['data-framework="svelte"', '.svelte', 's-'],
} as const;

function detectFrameworks(content: string): FrameworkDetection {
	return {
		solid: FRAMEWORK_PATTERNS.solid.some(pattern => content.includes(pattern)),
		vue: FRAMEWORK_PATTERNS.vue.some(pattern => content.includes(pattern)),
		svelte: FRAMEWORK_PATTERNS.svelte.some(pattern => content.includes(pattern)),
	};
}

function generateMetaTags(options: Partial<RenderOptions>): string {
	return options.meta?.map(({ name, content }) => `<meta name="${name}" content="${content}">`).join('\n    ') || '';
}

function generateStyleTags(options: Partial<RenderOptions>): string {
	const styleTags = options.styles?.map(href => `<link rel="stylesheet" href="${href}">`).join('\n    ') || '';
	const svelteSSRCSS = getSvelteSSRCSS(true);
	const svelteStyleTags = svelteSSRCSS ? `\n    ${svelteSSRCSS}` : '';
	return styleTags + svelteStyleTags;
}

function generateScriptTags(options: Partial<RenderOptions>): string {
	return (
		options.scripts
			?.map(script => {
				if (typeof script === 'string') {
					return `<script src="${script}" defer></script>`;
				}
				const attrs = script.src ? `src="${script.src}"` : '';
				const type = script.type ? `type="${script.type}"` : '';
				const content = script.content || '';
				return `<script ${attrs} ${type}>${content}</script>`;
			})
			.join('\n    ') || ''
	);
}

async function generateSolidHydrationScript(hasSolidComponents: boolean): Promise<string> {
	if (!hasSolidComponents) return '';

	try {
		const solidWeb = await import('solid-js/web');
		return solidWeb.generateHydrationScript ? `\n    ${solidWeb.generateHydrationScript()}` : '';
	} catch {
		console.warn('Solid.js not available, skipping hydration script');
		return '';
	}
}

function generateClientScripts(isDev: boolean, frameworks: FrameworkDetection): string {
	const baseScript = isDev ? '/src/client/main.js' : '/dist/client.js';
	const solidScript = frameworks.solid ? (isDev ? '/src/client/solid-hydration.js' : '/dist/solid-hydration.js') : '';

	return `
    <script type="module" src="${baseScript}"></script>
    ${solidScript ? `<script type="module" src="${solidScript}"></script>` : ''}
    ${frameworks.svelte ? '<!-- Svelte components now use self-contained hydration -->' : ''}`;
}

function generateHMRScript(isDev: boolean, viteHmrPort?: number): string {
	return isDev && viteHmrPort
		? `
    <script type="module">
      if (import.meta.hot) {
        import.meta.hot.accept();
      }
    </script>`
		: '';
}

async function generateHead(
	options: Partial<RenderOptions>,
	frameworks: FrameworkDetection,
	viteHmrPort?: number
): Promise<string> {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	const metaTags = generateMetaTags(options);
	const styleTags = generateStyleTags(options);
	const scriptTags = generateScriptTags(options);
	const solidHydrationScript = await generateSolidHydrationScript(frameworks.solid);
	const clientScripts = generateClientScripts(isDev, frameworks);
	const hmrScript = generateHMRScript(isDev, viteHmrPort);

	return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${metaTags}
      <title>${options.title || 'Avalon App'}</title>
      ${solidHydrationScript}
      ${styleTags}
      ${scriptTags}${clientScripts}${hmrScript}
    </head>`.trim();
}

export async function renderToHtml(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number
): Promise<string> {
	try {
		// Render component (handle both sync and async)
		const componentResult = routeConfig.component();
		const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
		const content = preactRenderToString(resolvedComponent);

		// Detect frameworks used in the rendered content
		const frameworks = detectFrameworks(content);

		// Merge route options with defaults
		const options = { ...defaultOptions, ...routeConfig.options };

		// Generate head with framework-specific optimizations
		const head = await generateHead(options, frameworks, viteHmrPort);

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
