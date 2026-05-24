import type { Integration } from "@useavalon/core";
import type { JSX } from "preact";
import { Fragment, h } from "preact";
import type { ViteDevServer } from "vite";
import { getIslandBundlePath } from "../build/island-manifest.ts";
import type { AnalyzerOptions } from "../core/components/component-analyzer.ts";
import { devError, devLog, devWarn, isDev, logRenderTiming } from "../utils/dev-logger.ts";
import { analyzeComponentFile, renderComponentSSROnly } from "./component-analysis.ts";
import { detectFramework } from "./framework-detection.ts";
import { isCustomDirective, serializeDirectiveScript } from "./hydration-directives.ts";
import { detectFrameworkFromPath, loadIntegration } from "./integration-loader.ts";
import { generatePerIslandScript } from "./per-island-script.ts";
import type { Framework } from "./types.ts";
import { addModulepreload } from "./modulepreload-collector.ts";
import { addUniversalCSS } from "./universal-css-collector.ts";
import { addUniversalHead } from "./universal-head-collector.ts";

// Enhanced global CSS collector for SSR with scoping support
declare global {
	var __viteDevServer: ViteDevServer | undefined;
	/** Hydration mode — automatically set: "entry-client" in dev (HMR), "per-island" in production */
	var __avalonHydrationMode: "entry-client" | "per-island" | undefined;
	/** Compile-time constant set by Vite define — true in production, false in dev */
	var __AVALON_PER_ISLAND__: boolean;
}

/** Supported hydration conditions for island components */
export type HydrationCondition =
	| "on:visible"
	| "on:interaction"
	| "on:idle"
	| "on:client"
	| `media:${string}`
	| `on:${string}`;

/** Supported framework identifiers (without "unknown") */
export type FrameworkId = Exclude<Framework, "unknown">;

export interface IslandProps {
	/** Path to the island component (e.g., "/islands/Counter.tsx") */
	src: string;
	/** Hydration condition */
	condition?: HydrationCondition;
	/** Optional argument passed to custom hydration directives */
	conditionArg?: string;
	/** Props to pass to the island component */
	props?: Record<string, unknown>;
	/** Children to render inside the island (for SSR) */
	children?: import("preact").ComponentChildren;
	/** Whether to render server-side (default: true unless condition is 'on:client') */
	ssr?: boolean;
	/** Framework hint for client hydration */
	framework?: FrameworkId;
	/** Force SSR-only rendering without hydration */
	ssrOnly?: boolean;
	/** Component render options for intelligent detection */
	renderOptions?: AnalyzerOptions;
	/** Hydration data from integration renderer */
	hydrationData?: Record<string, unknown>;
	/** Pre-imported component reference (avoids dynamic import in bundled SSR) */
	component?: unknown;
}

// ---------------------------------------------------------------------------
// Shared helpers (extracted to reduce cognitive complexity of Island/renderIsland)
// ---------------------------------------------------------------------------

/** Generate a deterministic island element ID from the source path */
function toIslandId(src: string): string {
	return `island-${src.replaceAll(/[^a-zA-Z0-9]/g, "-")}`;
}

/** Check if per-island hydration mode is active */
function isPerIslandMode(): boolean {
	// In production, always use per-island mode (better performance).
	// In dev, use entry-client mode (needed for HMR).
	if (globalThis.__avalonHydrationMode !== undefined) {
		return globalThis.__avalonHydrationMode === "per-island";
	}
	if (globalThis.__viteDevServer) {
		return false;
	}
	// __AVALON_PER_ISLAND__ is replaced at build/transform time by the Vite plugin.
	// In dev (command=serve) it's replaced with `false`.
	// In production (command=build) it's replaced with `true`.
	// This is the most reliable detection because it's a compile-time constant.
	if (typeof __AVALON_PER_ISLAND__ !== "undefined") {
		return __AVALON_PER_ISLAND__;
	}
	return !isDev();
}

/**
 * Wrap an island element with its per-island hydration script.
 * Returns the element unchanged if per-island mode is not active
 * or if the island should skip hydration.
 */
function wrapWithPerIslandScript(
	islandElement: JSX.Element,
	opts: {
		islandId: string;
		src: string;
		condition: HydrationCondition;
		conditionArg?: string;
		props: Record<string, unknown>;
		framework: string;
		shouldSkipHydration: boolean;
	},
): JSX.Element {
	if (!isPerIslandMode() || opts.shouldSkipHydration) {
		return islandElement;
	}

	const componentSrc = getIslandBundlePath(opts.src);

	// Register on:client islands for modulepreload — these are above-the-fold
	// islands that hydrate immediately and benefit from early fetching.
	// Deferred islands (on:visible, on:idle, on:interaction, media:*) are
	// intentionally excluded since preloading defeats lazy loading.
	if (opts.condition === "on:client") {
		addModulepreload(componentSrc);
	}
	const isCustom = isCustomDirective(opts.condition);
	const directiveScript = isCustom ? serializeDirectiveScript(opts.condition) : undefined;

	const scriptHtml = generatePerIslandScript({
		islandId: opts.islandId,
		componentSrc,
		framework: opts.framework,
		condition: opts.condition,
		conditionArg: opts.conditionArg,
		propsJson: JSON.stringify(opts.props),
		isCustomDirective: isCustom,
		directiveScript: directiveScript ?? undefined,
	});

	// Emit the island element followed by its self-contained hydration script.
	// We use a Fragment so both are siblings in the DOM output.
	// The wrapper <div data-island-script> is stripped from the final HTML by
	// `unwrapPerIslandScripts` in the renderer; the global framework baseline
	// CSS would also make it transparent if it ever leaked through.
	return h(
		Fragment,
		null,
		islandElement,
		h("div", {
			dangerouslySetInnerHTML: { __html: scriptHtml },
			"data-island-script": "",
		}),
	);
}

/** Build the extra hydration data-attributes from integration render output */
function buildHydrationDataAttrs(hydrationData: Record<string, unknown>): Record<string, string> {
	const attrs: Record<string, string> = {};
	if (hydrationData.renderId) {
		attrs["data-solid-render-id"] = hydrationData.renderId as string;
	}
	const metadata = hydrationData.metadata as Record<string, unknown> | undefined;
	if (metadata?.tagName) {
		attrs["data-tag-name"] = metadata.tagName as string;
	}
	return attrs;
}

/** Build the full set of attributes for an `<avalon-island>` element that will be hydrated */
function buildHydrateAttributes(
	src: string,
	condition: HydrationCondition,
	props: Record<string, unknown>,
	hydrationData: Record<string, unknown>,
	conditionArg?: string,
): Record<string, string> {
	const attrs: Record<string, string> = {
		"data-condition": condition,
		"data-src": getIslandBundlePath(src),
		"data-props": JSON.stringify(props),
		"data-render-strategy": "hydrate",
		...buildHydrationDataAttrs(hydrationData),
	};

	// Attach custom directive metadata if this is a custom condition
	if (isCustomDirective(condition)) {
		attrs["data-custom-directive"] = condition;
		const serialized = serializeDirectiveScript(condition);
		if (serialized) {
			attrs["data-directive-script"] = serialized;
		}
	}

	if (conditionArg) {
		attrs["data-condition-arg"] = conditionArg;
	}

	return attrs;
}

/** Detect the head-content type from an HTML string returned by an integration */
function classifyHeadContent(headContent: string): "script" | "meta" | "link" | "style" | "other" {
	if (headContent.startsWith("<script")) return "script";
	if (headContent.startsWith("<style")) return "style";
	if (headContent.startsWith("<meta")) return "meta";
	if (headContent.startsWith("<link")) return "link";
	if (headContent.includes("window._$HY") || headContent.includes("_$HY=")) return "script";
	return "other";
}

/** Extract CSS content from a <style> tag */
function extractCSSFromStyleTag(styleTag: string): string | null {
	const match = styleTag.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
	return match ? match[1].trim() : null;
}

/** Collect CSS and head content produced by an integration render */
function collectRenderAssets(
	renderResult: { css?: string; head?: string; scopeId?: string },
	src: string,
	framework: string,
	logPrefix: string,
): void {
	if (renderResult.css) {
		addUniversalCSS(
			renderResult.css,
			src,
			framework,
			(renderResult as { scopeId?: string }).scopeId,
		);
	}
	if (renderResult.head) {
		const headContent = renderResult.head.trim();
		const contentType = classifyHeadContent(headContent);
		if (contentType === "style") {
			// Extract CSS from <style> tag and add to universal CSS collector
			const cssContent = extractCSSFromStyleTag(headContent);
			if (cssContent) {
				devLog(`${logPrefix} Extracting CSS from head <style> tag`);
				addUniversalCSS(cssContent, src, framework, (renderResult as { scopeId?: string }).scopeId);
			}
			return;
		}
		addUniversalHead(renderResult.head, src, framework, contentType);
	}
}

// ---------------------------------------------------------------------------
// Island – the synchronous component that emits <avalon-island> custom elements
// ---------------------------------------------------------------------------

/** Render the SSR path: we already have rendered children to embed */
function renderIslandSSR(opts: {
	islandId: string;
	detectedFramework: string;
	shouldSkipHydration: boolean;
	src: string;
	condition: HydrationCondition;
	conditionArg?: string;
	props: Record<string, unknown>;
	hydrationData: Record<string, unknown>;
	children: import("preact").ComponentChildren;
}): JSX.Element {
	const {
		islandId,
		detectedFramework,
		shouldSkipHydration,
		src,
		condition,
		conditionArg,
		props,
		hydrationData,
		children,
	} = opts;
	const baseAttributes: Record<string, string> = {
		id: islandId,
		"data-framework": detectedFramework,
	};

	const hydrationAttributes = shouldSkipHydration
		? { "data-render-strategy": "ssr-only" }
		: buildHydrateAttributes(src, condition, props, hydrationData, conditionArg);

	if (detectedFramework === "lit") {
		devLog(`🔍 [Island Component] ${src} - Lit hydration data:`, {
			hydrationDataKeys: Object.keys(hydrationData),
			metadata: hydrationData.metadata,
		});
	}

	const allAttributes = { ...baseAttributes, ...hydrationAttributes };

	let islandElement: JSX.Element;
	if (typeof children === "string") {
		islandElement = h("avalon-island", {
			...allAttributes,
			dangerouslySetInnerHTML: { __html: children },
		});
	} else {
		islandElement = h("avalon-island", allAttributes, children);
	}

	return wrapWithPerIslandScript(islandElement, {
		islandId,
		src,
		condition,
		conditionArg,
		props,
		framework: detectedFramework,
		shouldSkipHydration,
	});
}

/** Render the client-only path: empty shell that will be hydrated on the client */
function renderIslandClientOnly(opts: {
	islandId: string;
	detectedFramework: string;
	shouldSkipHydration: boolean;
	src: string;
	condition: HydrationCondition;
	props: Record<string, unknown>;
	hydrationData: Record<string, unknown>;
	conditionArg?: string;
}): JSX.Element {
	const {
		islandId,
		detectedFramework,
		shouldSkipHydration,
		src,
		condition,
		props,
		hydrationData,
		conditionArg,
	} = opts;

	if (shouldSkipHydration) {
		return h("avalon-island", {
			id: islandId,
			"data-render-strategy": "ssr-only",
			"data-framework": detectedFramework,
		});
	}

	const attrs: Record<string, string> = {
		id: islandId,
		"data-condition": condition,
		"data-src": getIslandBundlePath(src),
		"data-props": JSON.stringify(props),
		"data-render-strategy": "hydrate",
		"data-framework": detectedFramework,
		...buildHydrationDataAttrs(hydrationData),
	};

	// Attach custom directive metadata
	if (isCustomDirective(condition)) {
		attrs["data-custom-directive"] = condition;
		const serialized = serializeDirectiveScript(condition);
		if (serialized) {
			attrs["data-directive-script"] = serialized;
		}
	}

	if (conditionArg) {
		attrs["data-condition-arg"] = conditionArg;
	}

	const islandElement = h("avalon-island", attrs);

	return wrapWithPerIslandScript(islandElement, {
		islandId,
		src,
		condition,
		conditionArg,
		props,
		framework: detectedFramework,
		shouldSkipHydration,
	});
}

/**
 * Universal Island component – renders `<avalon-island>` custom elements for better DOM structure.
 *
 * Uses custom elements instead of div wrappers for cleaner, more semantic markup.
 * Supports intelligent rendering strategy detection to skip hydration for SSR-only components.
 */
export default function Island({
	src,
	condition = "on:client",
	conditionArg,
	props = {},
	children,
	ssr = condition !== "on:client",
	framework,
	ssrOnly = false,
	renderOptions = {},
	hydrationData = {},
}: IslandProps): JSX.Element {
	const islandId = toIslandId(src);
	const shouldSkipHydration = ssrOnly || !!renderOptions.forceSSROnly;
	const detectedFramework = framework || detectFrameworkFromPath(src);
	const hasValidChildren = children !== undefined && children !== null && children !== "";

	devLog(`🔍 [Island Component] ${src}`, {
		ssr,
		ssrOnly,
		hasChildren: hasValidChildren,
		framework,
		condition,
	});

	if (ssr && hasValidChildren) {
		return renderIslandSSR({
			islandId,
			detectedFramework,
			shouldSkipHydration,
			src,
			condition,
			conditionArg,
			props,
			hydrationData,
			children,
		});
	}

	if (ssr && !hasValidChildren && shouldSkipHydration) {
		devWarn(
			`${src}: SSR-only component has no rendered content. This may indicate a rendering error.`,
		);
	}

	return renderIslandClientOnly({
		islandId,
		detectedFramework,
		shouldSkipHydration,
		src,
		condition,
		props,
		hydrationData,
		conditionArg,
	});
}

// ---------------------------------------------------------------------------
// renderErrorPlaceholder
// ---------------------------------------------------------------------------

/**
 * Render an error placeholder when island SSR fails.
 * @internal
 */
function renderErrorPlaceholder(src: string, error: unknown): JSX.Element {
	const errorMessage = error instanceof Error ? error.message : String(error);
	devError(`🚨 Island SSR failed for ${src}:`, error);
	if (error instanceof Error && error.stack) {
		devError(`Stack trace:`, error.stack);
	}
	return h("avalon-island", {
		id: toIslandId(src),
		"data-src": getIslandBundlePath(src),
		"data-ssr-error": errorMessage,
		"data-render-strategy": "client-only",
	});
}

// ---------------------------------------------------------------------------
// renderWithExplicitFramework (fast path)
// ---------------------------------------------------------------------------

/**
 * Render an island using the fast path when framework is explicitly provided.
 * @internal
 */
async function renderWithExplicitFramework({
	src,
	condition,
	conditionArg,
	props,
	children,
	ssr,
	framework,
	ssrOnly,
	renderOptions,
	component: preloadedComponent,
}: {
	src: string;
	condition: IslandProps["condition"];
	conditionArg?: string;
	props: Record<string, unknown>;
	children?: import("preact").ComponentChildren;
	ssr: boolean;
	framework: NonNullable<IslandProps["framework"]>;
	ssrOnly: boolean;
	renderOptions: AnalyzerOptions;
	component?: unknown;
}): Promise<JSX.Element> {
	const logPrefix = `🏝️ [${src}]`;

	if (!ssr || children) {
		return Island({
			src,
			condition,
			conditionArg,
			props,
			children,
			ssr,
			framework,
			ssrOnly,
			renderOptions,
		});
	}

	let integration: Integration;
	try {
		integration = await loadIntegration(framework);
	} catch (error) {
		devError(`${logPrefix} Failed to load ${framework} integration:`, error);
		return Island({
			src,
			condition,
			conditionArg,
			props,
			ssr: false,
			framework,
			ssrOnly,
			renderOptions,
		});
	}

	try {
		const renderResult = await integration.render({
			component: preloadedComponent ?? null,
			props,
			src,
			condition,
			ssrOnly,
			viteServer: globalThis.__viteDevServer,
			isDev: isDev(),
		});

		collectRenderAssets(renderResult, src, framework, logPrefix);

		return Island({
			src,
			condition,
			conditionArg,
			props,
			children: renderResult.html,
			ssr: true,
			framework,
			ssrOnly,
			renderOptions,
			hydrationData: ssrOnly ? undefined : renderResult.hydrationData,
		});
	} catch (error) {
		devError(`${logPrefix} Fast path SSR failed:`, error);
		return Island({
			src,
			condition,
			conditionArg,
			props,
			ssr: false,
			framework,
			ssrOnly,
			renderOptions,
		});
	}
}

// ---------------------------------------------------------------------------
// renderIsland slow-path helpers
// ---------------------------------------------------------------------------

/** Determine whether the component should skip hydration via analysis */
async function analyzeHydrationStrategy(
	src: string,
	ssrOnly: boolean,
	renderOptions: AnalyzerOptions,
	logPrefix: string,
): Promise<boolean> {
	if (ssrOnly || renderOptions.detectScripts === false) return ssrOnly;

	try {
		const analysisResult = await analyzeComponentFile(src, renderOptions);
		if (analysisResult.decision.warnings?.length) {
			for (const warning of analysisResult.decision.warnings) {
				devWarn(`${logPrefix} Analysis warning: ${warning}`);
			}
		}
		return !analysisResult.decision.shouldHydrate;
	} catch (error) {
		devWarn(`${logPrefix} Component analysis failed:`, error);
		return ssrOnly;
	}
}

/** Auto-detect framework from file extension / content */
async function detectFrameworkForSrc(src: string): Promise<string> {
	if (src.endsWith(".vue")) return "vue";
	if (src.endsWith(".svelte")) return "svelte";
	if (src.endsWith(".tsx") || src.endsWith(".jsx") || src.endsWith(".ts") || src.endsWith(".js")) {
		return detectFramework(src);
	}
	return "unknown";
}

/** Load an integration and render the component, returning the Island element */
async function renderSlowPathSSR(
	src: string,
	condition: HydrationCondition,
	props: Record<string, unknown>,
	ssrOnly: boolean,
	renderOptions: AnalyzerOptions,
	logPrefix: string,
	preloadedComponent?: unknown,
): Promise<JSX.Element> {
	const detectedFramework = await detectFrameworkForSrc(src);
	const frameworkId = detectedFramework as FrameworkId;

	const integration = await loadIntegrationOrThrow(detectedFramework, logPrefix);
	const renderResult = await integration.render({
		component: preloadedComponent ?? null,
		props,
		src,
		condition,
		ssrOnly,
		viteServer: globalThis.__viteDevServer,
		isDev: isDev(),
	});

	collectRenderAssets(renderResult, src, detectedFramework, logPrefix);

	const result = Island({
		src,
		condition,
		props,
		children: renderResult.html,
		ssr: true,
		framework: frameworkId,
		ssrOnly,
		renderOptions,
		hydrationData: ssrOnly ? undefined : renderResult.hydrationData,
	});

	return result;
}

/** Load an integration, throwing a descriptive error on failure */
async function loadIntegrationOrThrow(framework: string, logPrefix: string): Promise<Integration> {
	try {
		devLog(`${logPrefix} Loading integration for framework: ${framework}`);
		const integration = await loadIntegration(framework);
		devLog(`${logPrefix} ✅ Integration loaded successfully`);
		return integration;
	} catch (error) {
		devError(`${logPrefix} Failed to load ${framework} integration:`, error);
		throw new Error(
			`Failed to load integration for framework '${framework}'. ` +
				`Make sure @useavalon/${framework} is installed.\n` +
				`Install it with: deno add @useavalon/${framework}`,
			{ cause: error },
		);
	}
}

// ---------------------------------------------------------------------------
// renderIsland – the main async entry point
// ---------------------------------------------------------------------------

/**
 * Universal renderIsland function – auto-detects framework and handles SSR + hydration.
 *
 * This is the main function you should use – it automatically:
 * - Detects the component framework (Vue, Solid.js, Preact/React)
 * - Analyzes component for intelligent rendering strategy detection
 * - Handles server-side rendering when possible
 * - Falls back to client-only rendering when needed
 * - Returns the appropriate Island component
 *
 * Performance tip: Providing an explicit `framework` prop skips component analysis
 * and framework detection, significantly improving render performance.
 *
 * Error isolation: If SSR fails, returns an error placeholder instead of throwing,
 * allowing the page to continue rendering other islands.
 */
export async function renderIsland({
	src,
	condition = "on:client",
	conditionArg,
	props = {},
	children,
	ssr = condition !== "on:client",
	framework,
	ssrOnly = false,
	renderOptions = {},
	component: preloadedComponent,
}: IslandProps): Promise<JSX.Element> {
	const startTime = isDev() ? performance.now() : 0;
	const logPrefix = `🏝️ [${src}]`;

	try {
		// If ssrOnly is true we MUST enable SSR to render the component
		if (ssrOnly && !ssr) {
			ssr = true;
		}

		// Fast path: explicit framework skips all analysis/detection
		if (framework) {
			return await renderWithExplicitFramework({
				src,
				condition,
				conditionArg,
				props,
				children,
				ssr,
				framework,
				ssrOnly,
				renderOptions,
				component: preloadedComponent,
			});
		}

		// Slow path: detect framework and analyze component
		return await renderIslandSlowPath({
			src,
			condition,
			conditionArg,
			props,
			children,
			ssr,
			ssrOnly,
			renderOptions,
			logPrefix,
			component: preloadedComponent,
		});
	} catch (error) {
		return renderErrorPlaceholder(src, error);
	} finally {
		if (isDev()) {
			logRenderTiming(src, performance.now() - startTime);
		}
	}
}

/** Slow path for renderIsland – framework detection + component analysis */
async function renderIslandSlowPath(opts: {
	src: string;
	condition: HydrationCondition;
	conditionArg?: string;
	props: Record<string, unknown>;
	children: import("preact").ComponentChildren | undefined;
	ssr: boolean;
	ssrOnly: boolean;
	renderOptions: AnalyzerOptions;
	logPrefix: string;
	component?: unknown;
}): Promise<JSX.Element> {
	const {
		src,
		condition,
		conditionArg,
		props,
		children,
		ssr,
		ssrOnly,
		renderOptions,
		logPrefix,
		component: preloadedComponent,
	} = opts;
	devLog(`🔍 [renderIsland] ${src} - Starting render (slow path)`, {
		ssr,
		ssrOnly,
		hasChildren: !!children,
		condition,
	});

	const shouldSkipHydration = await analyzeHydrationStrategy(
		src,
		ssrOnly,
		renderOptions,
		logPrefix,
	);

	if (shouldSkipHydration) {
		return renderSSROnlyPath(src, condition, props, children, ssr, renderOptions, logPrefix);
	}

	// If SSR is disabled or we already have children, use basic Island
	if (!ssr || children) {
		return Island({ src, condition, conditionArg, props, children, ssr, renderOptions });
	}

	// Full SSR rendering with auto-detected framework
	try {
		return await renderSlowPathSSR(
			src,
			condition,
			props,
			ssrOnly,
			renderOptions,
			logPrefix,
			preloadedComponent,
		);
	} catch (error) {
		const detectedFramework = await detectFrameworkForSrc(src);
		devError(`${logPrefix} Framework rendering failed:`, error);
		return Island({
			src,
			condition,
			conditionArg,
			props,
			ssr: false,
			framework: detectedFramework as FrameworkId,
			renderOptions,
		});
	}
}

/** Handle the SSR-only path when hydration should be skipped */
function renderSSROnlyPath(
	src: string,
	condition: HydrationCondition,
	props: Record<string, unknown>,
	children: import("preact").ComponentChildren | undefined,
	ssr: boolean,
	renderOptions: AnalyzerOptions,
	logPrefix: string,
): Promise<JSX.Element> | JSX.Element {
	if (ssr && !children) {
		return renderComponentSSROnly({ src, condition, props, renderOptions }).catch((error) => {
			devError(`${logPrefix} SSR failed for SSR-only component:`, error);
			return Island({ src, condition, props, ssr: false, ssrOnly: true, renderOptions });
		});
	}
	return Island({ src, condition, props, children, ssr, ssrOnly: true, renderOptions });
}
