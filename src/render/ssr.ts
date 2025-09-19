import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import type { RenderOptions } from '../schemas/core.ts';
import { getSvelteSSRCSS } from '../islands/island.tsx';
import { analyzeComponentContent, type AnalyzerOptions } from '../helpers/component-analyzer.ts';

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
}

export interface RenderStrategy {
	type: 'hydrate' | 'ssr-only';
	reason: string;
	warnings?: string[];
}

export interface ComponentRenderOptions {
	forceSSROnly?: boolean;
	detectScripts?: boolean;
	suppressWarnings?: boolean;
	logDecisions?: boolean;
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

/**
 * Analyzes components in rendered content and adds rendering strategy attributes
 * using the intelligent component detection system
 */
async function enhanceContentWithRenderingStrategy(
	content: string,
	renderOptions: ComponentRenderOptions = {}
): Promise<string> {
	// Find all elements with data-hydrate attributes
	const hydrateRegex = /(<[^>]*data-hydrate="([^"]*)"[^>]*>)/g;
	let enhancedContent = content;
	const matches = Array.from(content.matchAll(hydrateRegex));

	for (const match of matches) {
		const [fullMatch, _elementTag, componentPath] = match;

		try {
			// Skip if already has render strategy
			if (fullMatch.includes('data-render-strategy')) {
				continue;
			}

			// Determine render strategy using intelligent component detection
			const strategy = await determineRenderStrategy(componentPath, renderOptions);

			// Skip hydration attribute generation for SSR-only components
			if (strategy.type === 'ssr-only') {
				// Remove data-hydrate attribute for SSR-only components
				const ssrOnlyTag = fullMatch
					.replace(/data-hydrate="[^"]*"\s*/g, '')
					.replace('>', ` data-render-strategy="${strategy.type}" data-ssr-reason="${strategy.reason}">`);
				enhancedContent = enhancedContent.replace(fullMatch, ssrOnlyTag);
			} else {
				// Add render strategy attribute while keeping hydration attributes
				const enhancedTag = fullMatch.replace(
					'>',
					` data-render-strategy="${strategy.type}" data-hydrate-reason="${strategy.reason}">`
				);
				enhancedContent = enhancedContent.replace(fullMatch, enhancedTag);
			}

			// Log the decision for debugging
			if (renderOptions.logDecisions !== false) {
				console.log(`[SSR Strategy] ${componentPath} -> ${strategy.type.toUpperCase()}: ${strategy.reason}`);
				if (strategy.warnings && strategy.warnings.length > 0 && !renderOptions.suppressWarnings) {
					strategy.warnings.forEach(warning => console.warn(`[SSR Warning] ${componentPath}: ${warning}`));
				}
			}
		} catch (error) {
			console.warn(`Failed to analyze component ${componentPath}:`, error);
			// Default to hydration on error for safety
			const enhancedTag = fullMatch.replace('>', ` data-render-strategy="hydrate" data-error="analysis-failed">`);
			enhancedContent = enhancedContent.replace(fullMatch, enhancedTag);
		}
	}

	return enhancedContent;
}

/**
 * Determines the render strategy for a component using intelligent detection
 */
async function determineRenderStrategy(
	componentPath: string,
	options: ComponentRenderOptions = {}
): Promise<RenderStrategy> {
	// Handle explicit SSR-only override
	if (options.forceSSROnly) {
		return {
			type: 'ssr-only',
			reason: 'Explicitly configured for SSR-only rendering',
		};
	}

	// Quick heuristic checks for known naming patterns that explicitly indicate SSR-only
	if (componentPath.includes('NoHydrate') || componentPath.includes('Static') || componentPath.includes('SSROnly')) {
		return {
			type: 'ssr-only',
			reason: 'Component name explicitly indicates SSR-only rendering',
		};
	}

	// If script detection is disabled, default to hydration
	if (options.detectScripts === false) {
		return {
			type: 'hydrate',
			reason: 'Script detection disabled, defaulting to hydration',
		};
	}

	try {
		// Try to read and analyze the component file
		let componentContent: string;
		let resolvedPath = componentPath;

		// Handle different path formats
		if (componentPath.startsWith('/')) {
			resolvedPath = componentPath.substring(1);
		}

		// Try multiple path variations
		const pathVariations = [
			resolvedPath,
			`examples/${resolvedPath.split('/').pop()}`,
			`src/islands/${resolvedPath.split('/').pop()}`,
			`islands/${resolvedPath.split('/').pop()}`,
		];

		let analysisResult = null;
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);

				// Perform intelligent component analysis
				const analyzerOptions: AnalyzerOptions = {
					forceSSROnly: options.forceSSROnly,
					detectScripts: options.detectScripts,
					suppressWarnings: options.suppressWarnings,
					logDecisions: false, // We'll handle logging at the SSR level
				};

				analysisResult = analyzeComponentContent(pathVariation, componentContent, analyzerOptions);
				break;
			} catch {
				// Continue to next path variation
				continue;
			}
		}

		if (analysisResult) {
			return {
				type: analysisResult.decision.shouldHydrate ? 'hydrate' : 'ssr-only',
				reason: analysisResult.decision.reason,
				warnings: analysisResult.decision.warnings,
			};
		}

		// If we can't read the file, fall back to extension-based heuristics
		return determineStrategyFromPath(componentPath);
	} catch (error) {
		console.warn(`Component analysis failed for ${componentPath}:`, error);
		return {
			type: 'ssr-only',
			reason: 'Analysis failed, defaulting to SSR-only for safety',
			warnings: [`Component analysis error: ${error instanceof Error ? error.message : String(error)}`],
		};
	}
}

/**
 * Fallback strategy determination based on file path and naming conventions
 */
function determineStrategyFromPath(componentPath: string): RenderStrategy {
	// Check file extension patterns - but default to SSR-only unless we can confirm hydration is needed
	if (
		componentPath.endsWith('.vue') ||
		componentPath.endsWith('.svelte') ||
		componentPath.endsWith('.tsx') ||
		componentPath.endsWith('.jsx')
	) {
		// Framework components default to SSR-only unless they have explicit hydrate functions
		return {
			type: 'ssr-only',
			reason: 'Framework component detected, defaulting to SSR-only (hydration requires explicit hydrate function)',
		};
	}

	// Unknown file type, default to SSR-only for safety
	return {
		type: 'ssr-only',
		reason: 'Unknown component type, defaulting to SSR-only for safety',
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
	viteHmrPort?: number,
	renderOptions: ComponentRenderOptions = {}
): Promise<string> {
	try {
		// Render component (handle both sync and async)
		const componentResult = routeConfig.component();
		const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
		let content = preactRenderToString(resolvedComponent);

		// Enhance content with intelligent rendering strategy analysis
		content = await enhanceContentWithRenderingStrategy(content, renderOptions);

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
