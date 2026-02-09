import type { JSX } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import type { RenderOptions } from '../schemas/core.ts';
import { getUniversalCSSForHead } from '../islands/universal-css-collector.ts';
import { getUniversalHeadForInjection } from '../islands/universal-head-collector.ts';
import { analyzeComponentContent, type AnalyzerOptions } from '../core/components/component-analyzer.ts';
import type { EnhancedLayoutResolver } from '../core/layout/enhanced-layout-resolver.ts';
import type { LayoutContext, PageModule } from '../types/layout.ts';
import { IsolatedSSRRenderer, type IsolatedRenderRequest, type SSRIsolationConfig } from './isolated-ssr-renderer.ts';

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
	frontmatter?: Record<string, unknown>;
}

export interface RenderStrategy {
	type: 'hydrate' | 'ssr-only';
	reason: string;
	warnings?: string[];
}

/**
 * Automatically injects the client-side hydration script and CSS if not already present
 */
function injectClientScript(html: string): string {
	let modifiedHtml = html;
	
	// Check if there are any islands that need hydration
	const hasIslands = html.includes('data-framework=') || html.includes('data-src=');

	if (!hasIslands) {
		// No islands found, no need to inject anything
		return html;
	}

	// Inject universal CSS into the head if not already present
	if (!html.includes('data-universal-ssr="true"')) {
		const universalCSS = getUniversalCSSForHead(true); // Clear after collecting
		if (universalCSS && html.includes('</head>')) {
			modifiedHtml = modifiedHtml.replace('</head>', `${universalCSS}\n</head>`);
		}
	}

	// Inject universal head content (hydration scripts, etc.) into the head
	const universalHead = getUniversalHeadForInjection(true); // Clear after collecting
	if (universalHead && html.includes('</head>')) {
		modifiedHtml = modifiedHtml.replace('</head>', `    ${universalHead}\n</head>`);
	}

	// Check if the client script is already included
	if (html.includes('/src/client/main.js') || html.includes('main.js')) {
		return modifiedHtml;
	}

	// Inject the client script before the closing </body> tag
	const clientScript = '<script type="module" src="/src/client/main.js"></script>';

	if (modifiedHtml.includes('</body>')) {
		return modifiedHtml.replace('</body>', `${clientScript}\n</body>`);
	}

	// Fallback: append to the end if no </body> tag found
	return modifiedHtml + clientScript;
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
	solid: ['solid-js', 'SolidIsland', 'createSignal', '.solid.', 'data-solid-hydrate'],
	vue: ['data-vue-hydrate', '.vue', 'Vue'],
	svelte: ['data-framework="svelte"', '.svelte', 's-'],
} as const;

// Global isolated SSR renderer instance
let isolatedRenderer: IsolatedSSRRenderer | null = null;

/**
 * Gets or creates the isolated SSR renderer
 */
function getIsolatedRenderer(): IsolatedSSRRenderer {
	if (!isolatedRenderer) {
		const config: Partial<SSRIsolationConfig> = {
			enableStrictIsolation: true,
			allowedCrossFrameworkImports: ['preact', 'preact-render-to-string'],
			errorHandling: 'fallback',
			debugLogging: Deno.env.get('DENO_ENV') !== 'production',
		};
		isolatedRenderer = new IsolatedSSRRenderer(config);
	}
	return isolatedRenderer;
}

function detectFrameworks(content: string): FrameworkDetection {
	return {
		solid: FRAMEWORK_PATTERNS.solid.some(pattern => content.includes(pattern)),
		vue: FRAMEWORK_PATTERNS.vue.some(pattern => content.includes(pattern)),
		svelte: FRAMEWORK_PATTERNS.svelte.some(pattern => content.includes(pattern)),
	};
}

/**
 * Validates that imports are allowed for the detected framework
 */
function validateFrameworkImports(componentPath: string, content: string, detectedFramework: string): string[] {
	const warnings: string[] = [];

	// Extract import statements
	const importRegex =
		/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
	const imports: string[] = [];

	let match;
	while ((match = importRegex.exec(content)) !== null) {
		imports.push(match[1]);
	}

	// Override framework detection based on naming convention
	let actualFramework = detectedFramework;
	if (componentPath.includes('.solid.')) {
		actualFramework = 'solid';
	} else if (componentPath.includes('.preact.')) {
		actualFramework = 'preact';
	}

	// Check for problematic cross-framework imports
	const problematicImports = new Map<string, string[]>([
		['preact', ['solid-js', 'solid-js/web', 'vue', 'svelte']],
		['solid', ['preact', 'preact-render-to-string', 'vue', 'svelte']],
		['vue', ['preact', 'solid-js', 'svelte']],
		['svelte', ['preact', 'solid-js', 'vue']],
	]);

	const forbidden = problematicImports.get(actualFramework) || [];

	for (const importPath of imports) {
		for (const forbiddenPattern of forbidden) {
			if (importPath.startsWith(forbiddenPattern)) {
				warnings.push(
					`Cross-framework import detected: ${actualFramework} component (${componentPath}) importing ${importPath}`
				);
			}
		}
	}

	return warnings;
}



/**
 * Analyzes components in rendered content and adds rendering strategy attributes
 * using the intelligent component detection system with import validation
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

			// Validate imports for cross-framework contamination
			await validateComponentImports(componentPath, renderOptions);

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

			// Log the decision for debugging (only when explicitly enabled)
			if (renderOptions.logDecisions === true) {
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
 * Validates component imports to prevent cross-framework contamination
 */
async function validateComponentImports(
	componentPath: string,
	renderOptions: ComponentRenderOptions = {}
): Promise<void> {
	try {
		// Try to read and analyze the component file
		let componentContent: string | undefined;
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

		let foundPath = '';
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);
				foundPath = pathVariation;
				break;
			} catch {
				// Continue to next path variation
				continue;
			}
		}

		if (!foundPath || !componentContent) {
			// Component file not found, skip validation
			return;
		}

		// Detect framework from content patterns
		const frameworks = detectFrameworks(componentContent);
		let detectedFramework = 'preact'; // default
		
		if (frameworks.solid) detectedFramework = 'solid';
		else if (frameworks.vue) detectedFramework = 'vue';
		else if (frameworks.svelte) detectedFramework = 'svelte';

		// Validate imports for this framework
		const importWarnings = validateFrameworkImports(foundPath, componentContent, detectedFramework);

		// Log import validation warnings
		if (importWarnings.length > 0 && !renderOptions.suppressWarnings) {
			importWarnings.forEach(warning => console.warn(`[Import Validation] ${warning}`));
		}
	} catch (error) {
		// Validation failed, but don't break the rendering process
		if (renderOptions.logDecisions !== false) {
			console.warn(`Import validation failed for ${componentPath}:`, error);
		}
	}
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
	
	// Note: CSS from all frameworks (including Svelte) is now handled by the universal CSS collector
	// which is injected in generateHead() via getUniversalCSSForHead()
	
	return styleTags;
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

function generateClientScripts(isDev: boolean, _frameworks: FrameworkDetection): string {
	const baseScript = isDev ? '/src/client/main.js' : '/dist/client.js';

	return `
    <script type="module" src="${baseScript}"></script>`;
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

function generateHead(
	options: Partial<RenderOptions>,
	frameworks: FrameworkDetection,
	viteHmrPort?: number
): string {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	const metaTags = generateMetaTags(options);
	const styleTags = generateStyleTags(options);
	const scriptTags = generateScriptTags(options);
	const clientScripts = generateClientScripts(isDev, frameworks);
	const hmrScript = generateHMRScript(isDev, viteHmrPort);
	
	// Collect CSS from all framework integrations
	const universalCSS = getUniversalCSSForHead(true); // Clear after collecting
	
	// Collect head content (hydration scripts, etc.) from all framework integrations
	const universalHead = getUniversalHeadForInjection(true); // Clear after collecting
	
	// Generate importmap for browser to resolve integration packages
	const importMap = `
    <script type="importmap">
    {
      "imports": {
        "@avalon/preact/client": "/packages/integrations/preact/client/index.ts",
        "@avalon/vue/client": "/packages/integrations/vue/client/index.ts",
        "@avalon/solid/client": "/packages/integrations/solid/client/index.ts",
        "@avalon/svelte/client": "/packages/integrations/svelte/client/index.ts",
        "@avalon/shared": "/packages/integrations/shared/types.ts"
      }
    }
    </script>`;

	return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${metaTags}
      <title>${options.title || 'Avalon App'}</title>
      ${importMap}
      ${styleTags}
      ${universalCSS}
      ${universalHead}
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
		let content: string;
		let frameworks: FrameworkDetection;

		// Check if we should use isolated rendering
		if (renderOptions.forceSSROnly !== true) {
			try {
				// Try to use isolated rendering for better framework separation
				const renderer = getIsolatedRenderer();

				// Create render request - we don't have a specific component path here,
				// so we'll use a generic path and let the renderer handle it
				const renderRequest: IsolatedRenderRequest = {
					componentPath: 'route-component',
					component: routeConfig.component,
				};

				const isolatedResult = await renderer.renderWithIsolation(renderRequest);

				if (isolatedResult.success) {
					content = isolatedResult.html;

					// Detect frameworks from the rendered content
					frameworks = detectFrameworks(content);

					// Log any warnings from isolated rendering
					if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
						isolatedResult.warnings.forEach(warning => console.warn(`[SSR Isolation] ${warning}`));
					}
				} else {
					throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(', ')}`);
				}
			} catch (isolatedError) {
				console.warn('[SSR] Isolated rendering failed, falling back to standard rendering:', isolatedError);

				// Fallback to standard rendering
				const componentResult = routeConfig.component();
				const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
				content = preactRenderToString(resolvedComponent);
				frameworks = detectFrameworks(content);
			}
		} else {
			// Standard rendering when explicitly requested
			const componentResult = routeConfig.component();
			const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
			content = preactRenderToString(resolvedComponent);
			frameworks = detectFrameworks(content);
		}

		// Enhance content with intelligent rendering strategy analysis
		content = await enhanceContentWithRenderingStrategy(content, renderOptions);

		// Merge route options with defaults
		const options = { ...defaultOptions, ...routeConfig.options };

		// Generate head with framework-specific optimizations
		const head = generateHead(options, frameworks, viteHmrPort);

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

/**
 * Render to HTML with layout system support
 * Requirements: 8.1, 8.2, 8.3
 */
export async function renderToHtmlWithLayouts(
	routeConfig: RouteConfig,
	layoutResolver: EnhancedLayoutResolver,
	layoutContext: LayoutContext,
	routePath: string,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number,
	renderOptions: ComponentRenderOptions = {}
): Promise<string> {
	try {
		// Create page module from route config
		const routeConfigExtended = routeConfig as RouteConfig & Partial<PageModule>;
		const pageModule: PageModule = {
			default: routeConfig.component,
			layoutConfig: routeConfigExtended.layoutConfig,
			loader: routeConfigExtended.loader,
			frontmatter: routeConfig.frontmatter,
		};

		// Resolve layouts using the enhanced layout resolver
		const resolvedLayout = await layoutResolver.resolveAndRender(routePath, pageModule, layoutContext);

		// If no layouts were resolved, fall back to standard rendering
		if (resolvedLayout.handlers.length === 0) {
			return await renderToHtml(routeConfig, defaultOptions, viteHmrPort, renderOptions);
		}

		let pageContent: string;

		// Use isolated rendering for page component if not explicitly disabled
		if (renderOptions.forceSSROnly !== true) {
			try {
				const renderer = getIsolatedRenderer();

				const renderRequest: IsolatedRenderRequest = {
					componentPath: routePath,
					component: routeConfig.component,
				};

				const isolatedResult = await renderer.renderWithIsolation(renderRequest);

				if (isolatedResult.success) {
					pageContent = isolatedResult.html;

					// Log any warnings from isolated rendering
					if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
						isolatedResult.warnings.forEach(warning => console.warn(`[SSR Isolation] ${warning}`));
					}
				} else {
					throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(', ')}`);
				}
			} catch (isolatedError) {
				console.warn('[SSR] Isolated page rendering failed, falling back to standard rendering:', isolatedError);

				// Fallback to standard rendering
				const componentResult = routeConfig.component();
				const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
				pageContent = preactRenderToString(resolvedComponent);
			}
		} else {
			// Standard rendering when explicitly requested
			const componentResult = routeConfig.component();
			const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
			pageContent = preactRenderToString(resolvedComponent);
		}

		// Apply layout chain from innermost to outermost
		let wrappedContent = pageContent;
		for (let i = resolvedLayout.handlers.length - 1; i >= 0; i--) {
			const handler = resolvedLayout.handlers[i];
			const layoutData = resolvedLayout.dataLoaders[i] ? await resolvedLayout.dataLoaders[i]!(layoutContext) : {};

			// Create layout props
			const layoutProps = {
				children: wrappedContent,
				data: layoutData,
				frontmatter: pageModule.frontmatter || {},
				route: {
					path: routePath,
					params: layoutContext.params,
					query: layoutContext.query,
				},
			};

			// Render the layout component with isolation if possible
			try {
				const renderer = getIsolatedRenderer();

				const layoutRenderRequest: IsolatedRenderRequest = {
					componentPath: `layout-${i}`,
					component: () => handler.component(layoutProps),
				};

				const layoutResult = await renderer.renderWithIsolation(layoutRenderRequest);

				if (layoutResult.success) {
					wrappedContent = layoutResult.html;
				} else {
					// Fallback to standard layout rendering
					const layoutElement = handler.component(layoutProps);
					wrappedContent = preactRenderToString(layoutElement);
				}
			} catch {
				// Fallback to standard layout rendering
				const layoutElement = handler.component(layoutProps);
				wrappedContent = preactRenderToString(layoutElement);
			}
		}

		// Check if the layout already rendered a complete HTML document
		const isCompleteHtmlDocument =
			wrappedContent.trim().startsWith('<!DOCTYPE html>') || wrappedContent.trim().startsWith('<html');

		if (isCompleteHtmlDocument) {
			// Layout rendered a complete HTML document, return it directly
			// Just enhance it with rendering strategy analysis
			const enhancedContent = await enhanceContentWithRenderingStrategy(wrappedContent, renderOptions);
			// Automatically inject client script if not already present
			return injectClientScript(enhancedContent);
		}

		// Layout rendered partial content, wrap it with HTML structure
		// Enhance content with intelligent rendering strategy analysis
		const enhancedContent = await enhanceContentWithRenderingStrategy(wrappedContent, renderOptions);

		// Detect frameworks used in the rendered content
		const frameworks = detectFrameworks(enhancedContent);

		// Merge route options with defaults
		const options = { ...defaultOptions, ...routeConfig.options };

		// Generate head with framework-specific optimizations
		const head = generateHead(options, frameworks, viteHmrPort);

		const finalHtml = `<!DOCTYPE html>
<html lang="en">
${head}
<body>
${enhancedContent}
</body>
</html>`;

		// Automatically inject client script if not already present
		return injectClientScript(finalHtml);
	} catch (error) {
		console.error('Error rendering component with layouts:', error);

		// Try to fall back to standard rendering
		try {
			return await renderToHtml(routeConfig, defaultOptions, viteHmrPort, renderOptions);
		} catch (fallbackError) {
			console.error('Fallback rendering also failed:', fallbackError);
			throw new Error('Failed to render component with layouts and fallback failed');
		}
	}
}


/**
 * Streaming render options
 */
export interface StreamingRenderOptions extends ComponentRenderOptions {
	/**
	 * Callback when the shell (initial HTML) is ready to stream
	 */
	onShellReady?: () => void;
	
	/**
	 * Callback when an error occurs before streaming starts
	 */
	onShellError?: (error: Error) => void;
	
	/**
	 * Callback when all content has been rendered
	 */
	onAllReady?: () => void;
	
	/**
	 * Callback for any error during rendering
	 */
	onError?: (error: Error) => void;
}

/**
 * Renders a route to a streaming HTML response
 * This is the streaming equivalent of renderToHtml()
 */
export async function renderToHtmlStream(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number,
	renderOptions: StreamingRenderOptions = {}
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let shellSent = false;
	
	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;
			
			try {
				// Render the component content first
				let content: string;
				let frameworks: FrameworkDetection;

				// Check if we should use isolated rendering
				if (renderOptions.forceSSROnly !== true) {
					try {
						// Try to use isolated rendering for better framework separation
						const renderer = getIsolatedRenderer();

						const renderRequest: IsolatedRenderRequest = {
							componentPath: 'route-component',
							component: routeConfig.component,
						};

						const isolatedResult = await renderer.renderWithIsolation(renderRequest);

						if (isolatedResult.success) {
							content = isolatedResult.html;
							frameworks = detectFrameworks(content);

							if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
								isolatedResult.warnings.forEach(warning => console.warn(`[SSR Isolation] ${warning}`));
							}
						} else {
							throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(', ')}`);
						}
					} catch (isolatedError) {
						console.warn('[SSR] Isolated rendering failed, falling back to standard rendering:', isolatedError);

						const componentResult = routeConfig.component();
						const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
						content = preactRenderToString(resolvedComponent);
						frameworks = detectFrameworks(content);
					}
				} else {
					const componentResult = routeConfig.component();
					const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
					content = preactRenderToString(resolvedComponent);
					frameworks = detectFrameworks(content);
				}

				// Enhance content with intelligent rendering strategy analysis
				content = await enhanceContentWithRenderingStrategy(content, renderOptions);

				// Merge route options with defaults
				const options = { ...defaultOptions, ...routeConfig.options };

				// Generate head with framework-specific optimizations
				const head = generateHead(options, frameworks, viteHmrPort);

				// Send the shell (DOCTYPE, html, head, body opening)
				const shell = `<!DOCTYPE html>
<html lang="en">
${head}
<body>
`;
				controller.enqueue(encoder.encode(shell));
				shellSent = true;
				
				// Notify that shell is ready
				if (renderOptions.onShellReady) {
					renderOptions.onShellReady();
				}

				// Send the content
				controller.enqueue(encoder.encode(content));

				// Send the footer (closing body and html tags)
				const footer = `
</body>
</html>`;
				controller.enqueue(encoder.encode(footer));

				// Notify that all content is ready
				if (renderOptions.onAllReady) {
					renderOptions.onAllReady();
				}

				controller.close();
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				
				// Log error details for debugging
				console.error('[Streaming Error]', {
					message: err.message,
					stack: err.stack,
					shellSent,
					timestamp: new Date().toISOString(),
				});
				
				// Call general error callback
				if (renderOptions.onError) {
					renderOptions.onError(err);
				}
				
				// If we haven't sent the shell yet, this is a pre-stream error
				if (!shellSent) {
					// Call onShellError callback for pre-stream errors
					if (renderOptions.onShellError) {
						renderOptions.onShellError(err);
					}
					
					// Send complete error page (HTTP 500 will be set by caller)
					if (controller) {
						const errorHtml = generateErrorPage(err);
						controller.enqueue(encoder.encode(errorHtml));
						controller.close();
					}
				} else {
					// Mid-stream error - inject error boundary and try to continue
					console.log('[Streaming] Mid-stream error detected, injecting error boundary');
					
					if (controller) {
						try {
							// Inject error boundary HTML into the stream
							const errorBoundary = generateMidStreamErrorBoundary(err, 'route-component');
							controller.enqueue(encoder.encode(errorBoundary));
							
							// Try to close the HTML document gracefully
							const footer = `
</body>
</html>`;
							controller.enqueue(encoder.encode(footer));
							
							console.log('[Streaming] Successfully injected error boundary and closed stream');
						} catch (injectError) {
							console.error('[Streaming] Failed to inject error boundary:', injectError);
						}
						
						controller.close();
					}
				}
			}
		},
		
		cancel() {
			if (controller) {
				try {
					controller.close();
				} catch {
					// Already closed
				}
			}
		}
	});
	
	return stream;
}

/**
 * Renders a route with layouts to a streaming HTML response
 * This is the streaming equivalent of renderToHtmlWithLayouts()
 */
export async function renderToHtmlStreamWithLayouts(
	routeConfig: RouteConfig,
	layoutResolver: EnhancedLayoutResolver,
	layoutContext: LayoutContext,
	routePath: string,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number,
	renderOptions: StreamingRenderOptions = {}
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let shellSent = false;
	
	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;
			
			try {
				// Create page module from route config
				const routeConfigExtended = routeConfig as RouteConfig & Partial<PageModule>;
				const pageModule: PageModule = {
					default: routeConfig.component,
					layoutConfig: routeConfigExtended.layoutConfig,
					loader: routeConfigExtended.loader,
					frontmatter: routeConfig.frontmatter,
				};

				// Resolve layouts using the enhanced layout resolver
				const resolvedLayout = await layoutResolver.resolveAndRender(routePath, pageModule, layoutContext);

				// If no layouts were resolved, fall back to standard streaming rendering
				if (resolvedLayout.handlers.length === 0) {
					const fallbackStream = await renderToHtmlStream(routeConfig, defaultOptions, viteHmrPort, renderOptions);
					const reader = fallbackStream.getReader();
					
					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							controller.enqueue(value);
						}
						controller.close();
					} finally {
						reader.releaseLock();
					}
					return;
				}

				// Render page content
				let pageContent: string;

				if (renderOptions.forceSSROnly !== true) {
					try {
						const renderer = getIsolatedRenderer();

						const renderRequest: IsolatedRenderRequest = {
							componentPath: routePath,
							component: routeConfig.component,
						};

						const isolatedResult = await renderer.renderWithIsolation(renderRequest);

						if (isolatedResult.success) {
							pageContent = isolatedResult.html;

							if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
								isolatedResult.warnings.forEach(warning => console.warn(`[SSR Isolation] ${warning}`));
							}
						} else {
							throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(', ')}`);
						}
					} catch (isolatedError) {
						console.warn('[SSR] Isolated page rendering failed, falling back to standard rendering:', isolatedError);

						const componentResult = routeConfig.component();
						const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
						pageContent = preactRenderToString(resolvedComponent);
					}
				} else {
					const componentResult = routeConfig.component();
					const resolvedComponent = componentResult instanceof Promise ? await componentResult : componentResult;
					pageContent = preactRenderToString(resolvedComponent);
				}

				// Apply layout chain from innermost to outermost
				let wrappedContent = pageContent;
				for (let i = resolvedLayout.handlers.length - 1; i >= 0; i--) {
					const handler = resolvedLayout.handlers[i];
					const layoutData = resolvedLayout.dataLoaders[i] ? await resolvedLayout.dataLoaders[i]!(layoutContext) : {};

					const layoutProps = {
						children: wrappedContent,
						data: layoutData,
						frontmatter: pageModule.frontmatter || {},
						route: {
							path: routePath,
							params: layoutContext.params,
							query: layoutContext.query,
						},
					};

					try {
						const renderer = getIsolatedRenderer();

						const layoutRenderRequest: IsolatedRenderRequest = {
							componentPath: `layout-${i}`,
							component: () => handler.component(layoutProps),
						};

						const layoutResult = await renderer.renderWithIsolation(layoutRenderRequest);

						if (layoutResult.success) {
							wrappedContent = layoutResult.html;
						} else {
							const layoutElement = handler.component(layoutProps);
							wrappedContent = preactRenderToString(layoutElement);
						}
					} catch {
						const layoutElement = handler.component(layoutProps);
						wrappedContent = preactRenderToString(layoutElement);
					}
				}

				// Check if the layout already rendered a complete HTML document
				const isCompleteHtmlDocument =
					wrappedContent.trim().startsWith('<!DOCTYPE html>') || wrappedContent.trim().startsWith('<html');

				if (isCompleteHtmlDocument) {
					// Layout rendered a complete HTML document
					const enhancedContent = await enhanceContentWithRenderingStrategy(wrappedContent, renderOptions);
					const finalHtml = injectClientScript(enhancedContent);
					
					controller.enqueue(encoder.encode(finalHtml));
					shellSent = true;
					
					if (renderOptions.onShellReady) {
						renderOptions.onShellReady();
					}
					
					if (renderOptions.onAllReady) {
						renderOptions.onAllReady();
					}
					
					controller.close();
					return;
				}

				// Layout rendered partial content, wrap it with HTML structure
				const enhancedContent = await enhanceContentWithRenderingStrategy(wrappedContent, renderOptions);

				// Detect frameworks used in the rendered content
				const frameworks = detectFrameworks(enhancedContent);

				// Merge route options with defaults
				const options = { ...defaultOptions, ...routeConfig.options };

				// Generate head with framework-specific optimizations
				const head = generateHead(options, frameworks, viteHmrPort);

				// Send the shell
				const shell = `<!DOCTYPE html>
<html lang="en">
${head}
<body>
`;
				controller.enqueue(encoder.encode(shell));
				shellSent = true;
				
				if (renderOptions.onShellReady) {
					renderOptions.onShellReady();
				}

				// Send the content
				controller.enqueue(encoder.encode(enhancedContent));

				// Send the footer
				const footer = `
</body>
</html>`;
				controller.enqueue(encoder.encode(footer));

				// Inject client script if needed
				const finalHtml = injectClientScript(`<!DOCTYPE html><html lang="en">${head}<body>${enhancedContent}</body></html>`);
				
				if (renderOptions.onAllReady) {
					renderOptions.onAllReady();
				}

				controller.close();
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				
				// Log error details for debugging
				console.error('[Streaming Error with Layouts]', {
					message: err.message,
					stack: err.stack,
					shellSent,
					routePath,
					timestamp: new Date().toISOString(),
				});
				
				// Call general error callback
				if (renderOptions.onError) {
					renderOptions.onError(err);
				}
				
				// If we haven't sent the shell yet, this is a pre-stream error
				if (!shellSent) {
					// Call onShellError callback for pre-stream errors
					if (renderOptions.onShellError) {
						renderOptions.onShellError(err);
					}
					
					// Send complete error page (HTTP 500 will be set by caller)
					if (controller) {
						const errorHtml = generateErrorPage(err);
						controller.enqueue(encoder.encode(errorHtml));
						controller.close();
					}
				} else {
					// Mid-stream error - inject error boundary and try to continue
					console.log('[Streaming with Layouts] Mid-stream error detected, injecting error boundary');
					
					if (controller) {
						try {
							// Inject error boundary HTML into the stream
							const errorBoundary = generateMidStreamErrorBoundary(err, `layout-${routePath}`);
							controller.enqueue(encoder.encode(errorBoundary));
							
							// Try to close the HTML document gracefully
							const footer = `
</body>
</html>`;
							controller.enqueue(encoder.encode(footer));
							
							console.log('[Streaming with Layouts] Successfully injected error boundary and closed stream');
						} catch (injectError) {
							console.error('[Streaming with Layouts] Failed to inject error boundary:', injectError);
						}
						
						controller.close();
					}
				}
			}
		},
		
		cancel() {
			if (controller) {
				try {
					controller.close();
				} catch {
					// Already closed
				}
			}
		}
	});
	
	return stream;
}

/**
 * Generates an error page for streaming errors
 */
function generateErrorPage(error: Error): string {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';
	
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #f5f5f5;
      }
      .error-container {
        max-width: 600px;
        margin: 0 auto;
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      h1 {
        color: #d32f2f;
        margin-top: 0;
      }
      pre {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 4px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1>Server Error</h1>
      <p>An error occurred while rendering the page:</p>
      <pre>${error.message}</pre>
      ${isDev && error.stack ? `<pre>${error.stack}</pre>` : ''}
    </div>
  </body>
</html>`;
}

/**
 * Generates error boundary HTML for mid-stream errors
 * This is injected into the stream when an error occurs after the shell has been sent
 */
function generateMidStreamErrorBoundary(error: Error, componentId?: string): string {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';
	
	return `
<div class="streaming-error-boundary" data-error-boundary="true" ${componentId ? `data-component-id="${componentId}"` : ''}>
  <div class="error-boundary-container" style="
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    font-family: system-ui, -apple-system, sans-serif;
  ">
    <div class="error-boundary-header" style="
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    ">
      <span style="font-size: 24px;">⚠️</span>
      <h3 style="margin: 0; color: #856404;">Component Error</h3>
    </div>
    <p style="margin: 10px 0; color: #856404;">
      An error occurred while rendering this component. The rest of the page should work normally.
    </p>
    ${isDev ? `
    <details style="margin-top: 15px;">
      <summary style="cursor: pointer; color: #856404; font-weight: bold;">
        Error Details (Development Mode)
      </summary>
      <div style="margin-top: 10px;">
        ${componentId ? `<p><strong>Component ID:</strong> ${componentId}</p>` : ''}
        <p><strong>Error:</strong> ${error.message}</p>
        ${error.stack ? `<pre style="
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          margin-top: 10px;
        ">${error.stack}</pre>` : ''}
      </div>
    </details>
    ` : ''}
  </div>
</div>
`;
}
