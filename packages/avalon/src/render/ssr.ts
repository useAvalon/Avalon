import { readFile } from "node:fs/promises";
import { h, type JSX } from "preact";
import { render as preactRenderToString } from "preact-render-to-string";
import {
	type AnalyzerOptions,
	analyzeComponentContent,
} from "../core/components/component-analyzer.ts";
import type { EnhancedLayoutResolver } from "../core/layout/enhanced-layout-resolver.ts";
import { getUniversalCSSForHead } from "../islands/universal-css-collector.ts";
import {
	getUniversalHeadForInjection,
	injectSolidHydrationScriptIfNeeded,
} from "../islands/universal-head-collector.ts";
import type { RenderOptions } from "../schemas/core.ts";
import type { LayoutContext, PageModule } from "../types/layout.ts";
import { IsolatedSSRRenderer, type SSRIsolationConfig } from "./isolated-ssr-renderer.ts";

export interface RouteConfig {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: Partial<RenderOptions>;
	frontmatter?: Record<string, unknown>;
}

export interface RenderStrategy {
	type: "hydrate" | "ssr-only";
	reason: string;
	warnings?: string[];
}

/**
 * Automatically injects the client-side hydration script and CSS if not already present
 */
function injectClientScript(html: string): string {
	let modifiedHtml = html;

	// Check if there are any islands that need hydration
	const hasIslands = html.includes("data-framework=") || html.includes("data-src=");

	if (!hasIslands) {
		// No islands found, no need to inject anything
		return html;
	}

	// Inject universal CSS into the head if not already present
	if (!html.includes('data-universal-ssr="true"')) {
		const universalCSS = getUniversalCSSForHead(true); // Clear after collecting
		if (universalCSS && html.includes("</head>")) {
			modifiedHtml = modifiedHtml.replace("</head>", `${universalCSS}\n</head>`);
		}
	}

	// Inject universal head content (hydration scripts, etc.) into the head
	const universalHead = getUniversalHeadForInjection(true); // Clear after collecting
	if (universalHead && html.includes("</head>")) {
		modifiedHtml = modifiedHtml.replace("</head>", `    ${universalHead}\n</head>`);
	}

	// Conditionally inject Solid hydration bootstrap only when Solid islands are present
	modifiedHtml = injectSolidHydrationScriptIfNeeded(modifiedHtml);

	// Check if the client script is already included
	if (html.includes("/src/client/main.js") || html.includes("main.js")) {
		return modifiedHtml;
	}

	// Inject the client script before the closing </body> tag
	const clientScript = '<script type="module" src="/src/client/main.js"></script>';

	if (modifiedHtml.includes("</body>")) {
		return modifiedHtml.replace("</body>", `${clientScript}\n</body>`);
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
	solid: ["solid-js", "SolidIsland", "createSignal", ".solid.", "data-solid-hydrate"],
	vue: ["data-vue-hydrate", ".vue", "Vue"],
	svelte: ['data-framework="svelte"', ".svelte", "s-"],
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
			allowedCrossFrameworkImports: ["preact", "preact-render-to-string"],
			errorHandling: "fallback",
			debugLogging: process.env.NODE_ENV !== "production",
		};
		isolatedRenderer = new IsolatedSSRRenderer(config);
	}
	return isolatedRenderer;
}

function detectFrameworks(content: string): FrameworkDetection {
	return {
		solid: FRAMEWORK_PATTERNS.solid.some((pattern) => content.includes(pattern)),
		vue: FRAMEWORK_PATTERNS.vue.some((pattern) => content.includes(pattern)),
		svelte: FRAMEWORK_PATTERNS.svelte.some((pattern) => content.includes(pattern)),
	};
}

/**
 * Validates that imports are allowed for the detected framework
 */
function validateFrameworkImports(
	componentPath: string,
	content: string,
	detectedFramework: string,
): string[] {
	const warnings: string[] = [];

	// Extract import statements — match the quoted module specifier at the end of any import line
	const importRegex = /^import\s[^'"]*['"]([^'"]+)['"]/gm;
	const imports: string[] = [];

	for (let match = importRegex.exec(content); match !== null; match = importRegex.exec(content)) {
		imports.push(match[1]);
	}

	// Override framework detection based on naming convention
	let actualFramework = detectedFramework;
	if (componentPath.includes(".solid.")) {
		actualFramework = "solid";
	} else if (componentPath.includes(".preact.")) {
		actualFramework = "preact";
	}

	// Check for problematic cross-framework imports
	const problematicImports = new Map<string, string[]>([
		["preact", ["solid-js", "solid-js/web", "vue", "svelte"]],
		["solid", ["preact", "preact-render-to-string", "vue", "svelte"]],
		["vue", ["preact", "solid-js", "svelte"]],
		["svelte", ["preact", "solid-js", "vue"]],
	]);

	const forbidden = problematicImports.get(actualFramework) || [];

	for (const importPath of imports) {
		for (const forbiddenPattern of forbidden) {
			if (importPath.startsWith(forbiddenPattern)) {
				warnings.push(
					`Cross-framework import detected: ${actualFramework} component (${componentPath}) importing ${importPath}`,
				);
			}
		}
	}

	return warnings;
}

function applyStrategyToTag(fullMatch: string, strategy: RenderStrategy): string {
	if (strategy.type === "ssr-only") {
		return fullMatch
			.replaceAll(/data-hydrate="[^"]*"\s*/g, "")
			.replace(
				">",
				` data-render-strategy="${strategy.type}" data-ssr-reason="${strategy.reason}">`,
			);
	}
	return fullMatch.replace(
		">",
		` data-render-strategy="${strategy.type}" data-hydrate-reason="${strategy.reason}">`,
	);
}

/**
 * Analyzes components in rendered content and adds rendering strategy attributes
 * using the intelligent component detection system with import validation
 */
async function enhanceContentWithRenderingStrategy(
	content: string,
	renderOptions: ComponentRenderOptions = {},
): Promise<string> {
	const hydrateRegex = /(<[^>]*data-hydrate="([^"]*)"[^>]*>)/g;
	let enhancedContent = content;
	const matches = Array.from(content.matchAll(hydrateRegex));

	for (const match of matches) {
		const [fullMatch, _elementTag, componentPath] = match;

		try {
			if (fullMatch.includes("data-render-strategy")) {
				continue;
			}

			const strategy = await determineRenderStrategy(componentPath, renderOptions);
			await validateComponentImports(componentPath, renderOptions);

			enhancedContent = enhancedContent.replace(fullMatch, applyStrategyToTag(fullMatch, strategy));

			if (renderOptions.logDecisions === true) {
				console.log(
					`[SSR Strategy] ${componentPath} -> ${strategy.type.toUpperCase()}: ${strategy.reason}`,
				);
				if (strategy.warnings && strategy.warnings.length > 0 && !renderOptions.suppressWarnings) {
					strategy.warnings.forEach((warning) =>
						console.warn(`[SSR Warning] ${componentPath}: ${warning}`),
					);
				}
			}
		} catch (error) {
			console.warn(`Failed to analyze component ${componentPath}:`, error);
			const enhancedTag = fullMatch.replace(
				">",
				` data-render-strategy="hydrate" data-error="analysis-failed">`,
			);
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
	renderOptions: ComponentRenderOptions = {},
): Promise<void> {
	try {
		// Try to read and analyze the component file
		let componentContent: string | undefined;
		let resolvedPath = componentPath;

		// Handle different path formats
		if (componentPath.startsWith("/")) {
			resolvedPath = componentPath.substring(1);
		}

		// Try multiple path variations
		const pathVariations = [
			resolvedPath,
			`examples/${resolvedPath.split("/").pop()}`,
			`src/islands/${resolvedPath.split("/").pop()}`,
			`islands/${resolvedPath.split("/").pop()}`,
		];

		let foundPath = "";
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await readFile(pathVariation, "utf-8");
				foundPath = pathVariation;
				break;
			} catch {}
		}

		if (!foundPath || !componentContent) {
			// Component file not found, skip validation
			return;
		}

		// Detect framework from content patterns
		const frameworks = detectFrameworks(componentContent);
		let detectedFramework = "preact"; // default

		if (frameworks.solid) detectedFramework = "solid";
		else if (frameworks.vue) detectedFramework = "vue";
		else if (frameworks.svelte) detectedFramework = "svelte";

		// Validate imports for this framework
		const importWarnings = validateFrameworkImports(foundPath, componentContent, detectedFramework);

		// Log import validation warnings
		if (importWarnings.length > 0 && !renderOptions.suppressWarnings) {
			importWarnings.forEach((warning) => console.warn(`[Import Validation] ${warning}`));
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
	options: ComponentRenderOptions = {},
): Promise<RenderStrategy> {
	// Handle explicit SSR-only override
	if (options.forceSSROnly) {
		return {
			type: "ssr-only",
			reason: "Explicitly configured for SSR-only rendering",
		};
	}

	// Quick heuristic checks for known naming patterns that explicitly indicate SSR-only
	if (
		componentPath.includes("NoHydrate") ||
		componentPath.includes("Static") ||
		componentPath.includes("SSROnly")
	) {
		return {
			type: "ssr-only",
			reason: "Component name explicitly indicates SSR-only rendering",
		};
	}

	// If script detection is disabled, default to hydration
	if (options.detectScripts === false) {
		return {
			type: "hydrate",
			reason: "Script detection disabled, defaulting to hydration",
		};
	}

	try {
		// Try to read and analyze the component file
		let componentContent: string;
		let resolvedPath = componentPath;

		// Handle different path formats
		if (componentPath.startsWith("/")) {
			resolvedPath = componentPath.substring(1);
		}

		// Try multiple path variations
		const pathVariations = [
			resolvedPath,
			`examples/${resolvedPath.split("/").pop()}`,
			`src/islands/${resolvedPath.split("/").pop()}`,
			`islands/${resolvedPath.split("/").pop()}`,
		];

		let analysisResult = null;
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await readFile(pathVariation, "utf-8");

				// Perform intelligent component analysis
				const analyzerOptions: AnalyzerOptions = {
					forceSSROnly: options.forceSSROnly,
					detectScripts: options.detectScripts,
					suppressWarnings: options.suppressWarnings,
					logDecisions: false, // We'll handle logging at the SSR level
				};

				analysisResult = analyzeComponentContent(pathVariation, componentContent, analyzerOptions);
				break;
			} catch {}
		}

		if (analysisResult) {
			return {
				type: analysisResult.decision.shouldHydrate ? "hydrate" : "ssr-only",
				reason: analysisResult.decision.reason,
				warnings: analysisResult.decision.warnings,
			};
		}

		// If we can't read the file, fall back to extension-based heuristics
		return determineStrategyFromPath(componentPath);
	} catch (error) {
		console.warn(`Component analysis failed for ${componentPath}:`, error);
		return {
			type: "ssr-only",
			reason: "Analysis failed, defaulting to SSR-only for safety",
			warnings: [
				`Component analysis error: ${error instanceof Error ? error.message : String(error)}`,
			],
		};
	}
}

/**
 * Fallback strategy determination based on file path and naming conventions
 */
function determineStrategyFromPath(componentPath: string): RenderStrategy {
	// Check file extension patterns - but default to SSR-only unless we can confirm hydration is needed
	if (
		componentPath.endsWith(".vue") ||
		componentPath.endsWith(".svelte") ||
		componentPath.endsWith(".tsx") ||
		componentPath.endsWith(".jsx")
	) {
		// Framework components default to SSR-only unless they have explicit hydrate functions
		return {
			type: "ssr-only",
			reason:
				"Framework component detected, defaulting to SSR-only (hydration requires explicit hydrate function)",
		};
	}

	// Unknown file type, default to SSR-only for safety
	return {
		type: "ssr-only",
		reason: "Unknown component type, defaulting to SSR-only for safety",
	};
}

function generateMetaTags(options: Partial<RenderOptions>): string {
	return (
		options.meta
			?.map(({ name, content }) => `<meta name="${name}" content="${content}">`)
			.join("\n    ") || ""
	);
}

function generateStyleTags(options: Partial<RenderOptions>): string {
	const styleTags =
		options.styles?.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n    ") || "";

	// Note: CSS from all frameworks (including Svelte) is now handled by the universal CSS collector
	// which is injected in generateHead() via getUniversalCSSForHead()

	return styleTags;
}

function generateScriptTags(options: Partial<RenderOptions>): string {
	return (
		options.scripts
			?.map((script) => {
				if (typeof script === "string") {
					return `<script src="${script}" defer></script>`;
				}
				const attrs = script.src ? `src="${script.src}"` : "";
				const type = script.type ? `type="${script.type}"` : "";
				const content = script.content || "";
				return `<script ${attrs} ${type}>${content}</script>`;
			})
			.join("\n    ") || ""
	);
}

function generateClientScripts(isDev: boolean, _frameworks: FrameworkDetection): string {
	const baseScript = isDev ? "/src/client/main.js" : "/dist/client.js";

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
		: "";
}

/** Escape HTML special characters for safe interpolation into HTML */
function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function generateHead(
	options: Partial<RenderOptions>,
	frameworks: FrameworkDetection,
	viteHmrPort?: number,
): string {
	const isDev = process.env.NODE_ENV !== "production";

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
        "@useavalon/preact/client": "/packages/integrations/preact/client/index.ts",
        "@useavalon/vue/client": "/packages/integrations/vue/client/index.ts",
        "@useavalon/solid/client": "/packages/integrations/solid/client/index.ts",
        "@useavalon/svelte/client": "/packages/integrations/svelte/client/index.ts",
        "@useavalon/shared": "/packages/integrations/core/types.ts"
      }
    }
    </script>`;

	return `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${metaTags}
      <title>${escapeHtml(String(options.title || "Avalon App"))}</title>
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
	renderOptions: ComponentRenderOptions = {},
): Promise<string> {
	try {
		let content: string;
		let frameworks: FrameworkDetection;

		if (renderOptions.forceSSROnly === true) {
			const componentResult = routeConfig.component();
			const resolvedComponent =
				componentResult instanceof Promise ? await componentResult : componentResult;
			content = preactRenderToString(resolvedComponent);
			frameworks = detectFrameworks(content);
		} else {
			({ content, frameworks } = await renderWithIsolationOrFallback(routeConfig, renderOptions));
		}

		content = await enhanceContentWithRenderingStrategy(content, renderOptions);
		const options = { ...defaultOptions, ...routeConfig.options };
		const head = generateHead(options, frameworks, viteHmrPort);

		let html = `<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n${content}\n</body>\n</html>`;
		html = injectSolidHydrationScriptIfNeeded(html);
		return html;
	} catch (error) {
		console.error("Error rendering component:", error);
		throw new Error("Failed to render component");
	}
}

/**
 * Render to HTML with layout system support
 */
export async function renderToHtmlWithLayouts(
	routeConfig: RouteConfig,
	layoutResolver: EnhancedLayoutResolver,
	layoutContext: LayoutContext,
	routePath: string,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number,
	renderOptions: ComponentRenderOptions = {},
): Promise<string> {
	try {
		const routeConfigExtended = routeConfig as RouteConfig & Partial<PageModule>;
		const pageModule: PageModule = {
			default: routeConfig.component,
			layoutConfig: routeConfigExtended.layoutConfig,
			loader: routeConfigExtended.loader,
			frontmatter: routeConfig.frontmatter,
		};

		const resolvedLayout = await layoutResolver.resolveAndRender(
			routePath,
			pageModule,
			layoutContext,
		);

		if (resolvedLayout.handlers.length === 0) {
			return await renderToHtml(routeConfig, defaultOptions, viteHmrPort, renderOptions);
		}

		const pageContent = await renderPageContent(routeConfig, routePath, renderOptions);
		const wrappedContent = await applyLayoutChain(
			pageContent,
			resolvedLayout,
			pageModule,
			layoutContext,
			routePath,
		);
		const enhancedContent = await enhanceContentWithRenderingStrategy(
			wrappedContent,
			renderOptions,
		);

		return assembleLayoutHtml(enhancedContent, routeConfig, defaultOptions, viteHmrPort);
	} catch (error) {
		console.error("Error rendering component with layouts:", error);
		try {
			return await renderToHtml(routeConfig, defaultOptions, viteHmrPort, renderOptions);
		} catch (fallbackError) {
			console.error("Fallback rendering also failed:", fallbackError);
			throw new Error("Failed to render component with layouts and fallback failed");
		}
	}
}

function assembleLayoutHtml(
	enhancedContent: string,
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions>,
	viteHmrPort: number | undefined,
): string {
	const isCompleteDoc =
		enhancedContent.trim().startsWith("<!DOCTYPE html>") ||
		enhancedContent.trim().startsWith("<html");
	if (isCompleteDoc) {
		return injectClientScript(enhancedContent);
	}
	const frameworks = detectFrameworks(enhancedContent);
	const options = { ...defaultOptions, ...routeConfig.options };
	const head = generateHead(options, frameworks, viteHmrPort);
	return injectClientScript(
		`<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n${enhancedContent}\n</body>\n</html>`,
	);
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
 * Renders route component content to an HTML string, using isolated rendering with fallback.
 */
async function renderStreamContent(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions>,
	viteHmrPort: number | undefined,
	renderOptions: StreamingRenderOptions,
): Promise<{ head: string; content: string }> {
	let content: string;
	let frameworks: FrameworkDetection;

	if (renderOptions.forceSSROnly === true) {
		const componentResult = routeConfig.component();
		const resolvedComponent =
			componentResult instanceof Promise ? await componentResult : componentResult;
		content = preactRenderToString(resolvedComponent);
		frameworks = detectFrameworks(content);
	} else {
		({ content, frameworks } = await renderWithIsolationOrFallback(routeConfig, renderOptions));
	}

	content = await enhanceContentWithRenderingStrategy(content, renderOptions);
	const options = { ...defaultOptions, ...routeConfig.options };
	const head = generateHead(options, frameworks, viteHmrPort);
	return { head, content };
}

async function renderWithIsolationOrFallback(
	routeConfig: RouteConfig,
	renderOptions: StreamingRenderOptions,
): Promise<{ content: string; frameworks: FrameworkDetection }> {
	try {
		const renderer = getIsolatedRenderer();
		const isolatedResult = await renderer.renderWithIsolation({
			componentPath: "route-component",
			component: routeConfig.component,
		});

		if (!isolatedResult.success) {
			throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(", ")}`);
		}

		if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
			isolatedResult.warnings.forEach((w) => console.warn(`[SSR Isolation] ${w}`));
		}

		return { content: isolatedResult.html, frameworks: detectFrameworks(isolatedResult.html) };
	} catch (isolatedError) {
		console.warn(
			"[SSR] Isolated rendering failed, falling back to standard rendering:",
			isolatedError,
		);
		const componentResult = routeConfig.component();
		const resolvedComponent =
			componentResult instanceof Promise ? await componentResult : componentResult;
		const content = preactRenderToString(resolvedComponent);
		return { content, frameworks: detectFrameworks(content) };
	}
}

function handleStreamError(
	err: Error,
	shellSent: boolean,
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder,
	renderOptions: StreamingRenderOptions,
	label = "Streaming Error",
	componentId = "route-component",
): void {
	console.error(`[${label}]`, {
		message: err.message,
		stack: err.stack,
		shellSent,
		timestamp: new Date().toISOString(),
	});
	renderOptions.onError?.(err);

	if (shellSent) {
		console.log(`[${label}] Mid-stream error detected, injecting error boundary`);
		try {
			controller.enqueue(encoder.encode(generateMidStreamErrorBoundary(err, componentId)));
			controller.enqueue(encoder.encode("\n</body>\n</html>"));
		} catch (injectError) {
			console.error(`[${label}] Failed to inject error boundary:`, injectError);
		}
	} else {
		renderOptions.onShellError?.(err);
		controller.enqueue(encoder.encode(generateErrorPage(err)));
	}
	controller.close();
}

/**
 * Renders a route to a streaming HTML response
 * This is the streaming equivalent of renderToHtml()
 */
export async function renderToHtmlStream(
	routeConfig: RouteConfig,
	defaultOptions: Partial<RenderOptions> = {},
	viteHmrPort?: number,
	renderOptions: StreamingRenderOptions = {},
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let shellSent = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;
			try {
				const { head, content } = await renderStreamContent(
					routeConfig,
					defaultOptions,
					viteHmrPort,
					renderOptions,
				);

				controller.enqueue(encoder.encode(`<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n`));
				shellSent = true;
				renderOptions.onShellReady?.();

				controller.enqueue(encoder.encode(content));
				controller.enqueue(encoder.encode("\n</body>\n</html>"));
				renderOptions.onAllReady?.();
				controller.close();
			} catch (error) {
				handleStreamError(
					error instanceof Error ? error : new Error(String(error)),
					shellSent,
					controller,
					encoder,
					renderOptions,
				);
			}
		},
		cancel() {
			try {
				controller?.close();
			} catch {
				/* already closed */
			}
		},
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
	renderOptions: StreamingRenderOptions = {},
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let shellSent = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;
			try {
				const routeConfigExtended = routeConfig as RouteConfig & Partial<PageModule>;
				const pageModule: PageModule = {
					default: routeConfig.component,
					layoutConfig: routeConfigExtended.layoutConfig,
					loader: routeConfigExtended.loader,
					frontmatter: routeConfig.frontmatter,
				};

				const resolvedLayout = await layoutResolver.resolveAndRender(
					routePath,
					pageModule,
					layoutContext,
				);

				if (resolvedLayout.handlers.length === 0) {
					const fallbackStream = await renderToHtmlStream(
						routeConfig,
						defaultOptions,
						viteHmrPort,
						renderOptions,
					);
					const reader = fallbackStream.getReader();
					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							controller.enqueue(value);
						}
					} finally {
						reader.releaseLock();
					}
					controller.close();
					return;
				}

				const pageContent = await renderPageContent(routeConfig, routePath, renderOptions);
				const wrappedContent = await applyLayoutChain(
					pageContent,
					resolvedLayout,
					pageModule,
					layoutContext,
					routePath,
				);
				const enhancedContent = await enhanceContentWithRenderingStrategy(
					wrappedContent,
					renderOptions,
				);

				const isCompleteDoc =
					enhancedContent.trim().startsWith("<!DOCTYPE html>") ||
					enhancedContent.trim().startsWith("<html");
				if (isCompleteDoc) {
					const finalHtml = injectClientScript(enhancedContent);
					controller.enqueue(encoder.encode(finalHtml));
					shellSent = true;
					renderOptions.onShellReady?.();
					renderOptions.onAllReady?.();
					controller.close();
					return;
				}

				const frameworks = detectFrameworks(enhancedContent);
				const options = { ...defaultOptions, ...routeConfig.options };
				const head = generateHead(options, frameworks, viteHmrPort);

				controller.enqueue(encoder.encode(`<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n`));
				shellSent = true;
				renderOptions.onShellReady?.();

				controller.enqueue(encoder.encode(enhancedContent));
				controller.enqueue(encoder.encode("\n</body>\n</html>"));
				renderOptions.onAllReady?.();
				controller.close();
			} catch (error) {
				handleStreamError(
					error instanceof Error ? error : new Error(String(error)),
					shellSent,
					controller,
					encoder,
					renderOptions,
					"Streaming Error with Layouts",
					`layout-${routePath}`,
				);
			}
		},
		cancel() {
			try {
				controller?.close();
			} catch {
				/* already closed */
			}
		},
	});

	return stream;
}

async function renderPageContent(
	routeConfig: RouteConfig,
	routePath: string,
	renderOptions: StreamingRenderOptions,
): Promise<string> {
	if (renderOptions.forceSSROnly === true) {
		const componentResult = routeConfig.component();
		const resolved = componentResult instanceof Promise ? await componentResult : componentResult;
		return preactRenderToString(resolved);
	}
	try {
		const renderer = getIsolatedRenderer();
		const isolatedResult = await renderer.renderWithIsolation({
			componentPath: routePath,
			component: routeConfig.component,
		});
		if (!isolatedResult.success)
			throw new Error(`Isolated rendering failed: ${isolatedResult.errors.join(", ")}`);
		if (isolatedResult.warnings.length > 0 && !renderOptions.suppressWarnings) {
			isolatedResult.warnings.forEach((w) => console.warn(`[SSR Isolation] ${w}`));
		}
		return isolatedResult.html;
	} catch (isolatedError) {
		console.warn(
			"[SSR] Isolated page rendering failed, falling back to standard rendering:",
			isolatedError,
		);
		const componentResult = routeConfig.component();
		const resolved = componentResult instanceof Promise ? await componentResult : componentResult;
		return preactRenderToString(resolved);
	}
}

async function applyLayoutChain(
	pageContent: string,
	resolvedLayout: Awaited<ReturnType<EnhancedLayoutResolver["resolveAndRender"]>>,
	pageModule: PageModule,
	layoutContext: LayoutContext,
	routePath: string,
): Promise<string> {
	// Build a composed JSX tree: outermost layout wraps inner layouts wraps page content.
	// The innermost layout receives the page content as actual JSX children,
	// eliminating the need for dangerouslySetInnerHTML in layout components.
	//
	// We start from the innermost layout and work outward, building a nested
	// JSX element tree. The final tree is rendered to HTML in one pass.

	// Start with the page content as a raw-HTML JSX node.
	// Preact's `dangerouslySetInnerHTML` is used here at the framework level
	// so layout authors never need to use it themselves.
	let tree: JSX.Element = h("avalon-page-content", {
		dangerouslySetInnerHTML: { __html: pageContent },
	});

	// Track whether the final output was already rendered to HTML by an async
	// layout (e.g. the root layout that produces a full <html> document).
	let preRenderedHtml: string | null = null;

	// Wrap from innermost to outermost layout
	for (let i = resolvedLayout.handlers.length - 1; i >= 0; i--) {
		const handler = resolvedLayout.handlers[i];
		const layoutData = resolvedLayout.dataLoaders[i]
			? await resolvedLayout.dataLoaders[i](layoutContext)
			: {};
		const layoutProps = {
			data: layoutData,
			frontmatter: pageModule.frontmatter || {},
			route: { path: routePath, params: layoutContext.params, query: layoutContext.query },
		} as Record<string, unknown>;

		// Layout components may be async when they contain island transforms
		// (the page-island-transform plugin injects `await renderIsland(...)` calls).
		// Preact's renderToString doesn't support async components, so we
		// pre-resolve async layouts here before composing the JSX tree.
		const component = handler.component as any;
		const result = component({ ...layoutProps, children: tree });
		if (result instanceof Promise) {
			const resolved = await result;
			const html = preactRenderToString(resolved);
			// If this is the outermost layout (i === 0) or it produced a full
			// HTML document, keep the rendered string directly so downstream
			// code (assembleLayoutHtml) can detect the <html> tag and preserve
			// the layout's own <head> (which may contain stylesheet links like
			// syntax-highlighting.css).
			if (i === 0) {
				preRenderedHtml = html;
			} else {
				tree = h("avalon-layout-fragment", { dangerouslySetInnerHTML: { __html: html } });
			}
		} else {
			// Synchronous layout — use standard Preact composition
			tree = h(component, layoutProps, tree);
		}
	}

	// If the outermost layout was async and already rendered, return directly.
	if (preRenderedHtml !== null) {
		return preRenderedHtml;
	}

	// Render the entire composed tree to HTML in one pass
	try {
		const renderer = getIsolatedRenderer();
		const result = await renderer.renderWithIsolation({
			componentPath: `layout-chain-${routePath}`,
			component: () => tree,
		});
		if (result.success) {
			return result.html;
		}
	} catch {
		// Fall through to standard rendering
	}
	return preactRenderToString(tree);
}

/**
 * Generates an error page for streaming errors
 */
function generateErrorPage(error: Error): string {
	const isDev = process.env.NODE_ENV !== "production";

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
      ${isDev && error.stack ? `<pre>${error.stack}</pre>` : ""}
    </div>
  </body>
</html>`;
}

function generateMidStreamErrorBoundary(error: Error, componentId?: string): string {
	const isDev = process.env.NODE_ENV !== "production";
	const componentIdHtml = componentId ? `<p><strong>Component ID:</strong> ${componentId}</p>` : "";
	const stackHtml = error.stack
		? `<pre style="background:#f5f5f5;padding:10px;border-radius:4px;overflow-x:auto;font-size:12px;margin-top:10px">${error.stack}</pre>`
		: "";
	const devDetails = isDev
		? `<details style="margin-top:15px"><summary style="cursor:pointer;color:#856404;font-weight:bold">Error Details (Development Mode)</summary><div style="margin-top:10px">${componentIdHtml}<p><strong>Error:</strong> ${error.message}</p>${stackHtml}</div></details>`
		: "";
	const componentAttr = componentId ? ` data-component-id="${componentId}"` : "";

	return `
<div class="streaming-error-boundary" data-error-boundary="true"${componentAttr}>
  <div class="error-boundary-container" style="background:#fff3cd;border:2px solid #ffc107;border-radius:8px;padding:20px;margin:20px 0;font-family:system-ui,-apple-system,sans-serif">
    <div class="error-boundary-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:24px">⚠️</span>
      <h3 style="margin:0;color:#856404">Component Error</h3>
    </div>
    <p style="margin:10px 0;color:#856404">An error occurred while rendering this component. The rest of the page should work normally.</p>
    ${devDetails}
  </div>
</div>
`;
}
