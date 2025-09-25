import type { JSX } from 'preact';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { getIslandBundlePath } from '../build/island-manifest.ts';
import type { ViteDevServer } from 'vite';
import type { Component } from 'svelte';
import { analyzeComponentContent, type AnalyzerOptions } from '../core/components/component-analyzer.ts';
import { FrameworkModuleResolver } from '../core/modules/framework-module-resolver.ts';

// Global CSS collector for SSR
declare global {
	var __viteDevServer: ViteDevServer | undefined;
	var __svelteSSRCSS: Set<string> | undefined;
}

// Initialize global CSS collector
if (typeof globalThis !== 'undefined' && !globalThis.__svelteSSRCSS) {
	globalThis.__svelteSSRCSS = new Set();
}

/**
 * Get collected Svelte SSR CSS and optionally clear the collection
 */
export function getSvelteSSRCSS(clear = false): string {
	if (!globalThis.__svelteSSRCSS) {
		return '';
	}

	const cssArray = Array.from(globalThis.__svelteSSRCSS);
	if (clear) {
		globalThis.__svelteSSRCSS.clear();
	}

	return cssArray.join('\n');
}

export interface IslandProps {
	/** Path to the island component (e.g., "/islands/Counter.tsx") */
	src: string;
	/** Hydration condition */
	condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
	/** Props to pass to the island component */
	props?: Record<string, unknown>;
	/** Children to render inside the island (for SSR) */
	children?: JSX.Element | JSX.Element[] | string;
	/** Whether to render server-side (default: true unless condition is 'on:client') */
	ssr?: boolean;
	/** Framework hint for client hydration */
	framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
	/** Force SSR-only rendering without hydration */
	ssrOnly?: boolean;
	/** Component render options for intelligent detection */
	renderOptions?: AnalyzerOptions;
}

/**
 * Universal Island component - renders <is-land> custom elements for better DOM structure
 *
 * Uses custom elements instead of div wrappers for cleaner, more semantic markup
 * Supports intelligent rendering strategy detection to skip hydration for SSR-only components
 */
export default function Island({
	src,
	condition = 'on:client',
	props = {},
	children,
	ssr = condition !== 'on:client',
	framework,
	ssrOnly = false,
	renderOptions = {},
}: IslandProps): JSX.Element {
	// Generate deterministic ID for the island (SSR-safe)
	// Use src path to ensure server and client generate the same ID
	const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;

	// Determine if this should be SSR-only based on explicit flag or render options
	const shouldSkipHydration = ssrOnly || renderOptions.forceSSROnly;

	// Only get bundle path if we need hydration
	const bundlePath = shouldSkipHydration ? '' : getIslandBundlePath(src);

	// If we have SSR content (children), render it directly in the is-land element
	if (ssr && children) {
		const baseAttributes = {
			id: islandId,
			...(framework ? { 'data-framework': framework } : {}),
		};

		// Add hydration attributes only if not SSR-only
		const hydrationAttributes = shouldSkipHydration
			? {
					'data-render-strategy': 'ssr-only',
			  }
			: {
					'data-island': condition,
					'data-hydrate': bundlePath,
					'data-props': JSON.stringify(props),
					'data-render-strategy': 'hydrate',
			  };

		const allAttributes = { ...baseAttributes, ...hydrationAttributes };

		if (typeof children === 'string') {
			return h('is-land', {
				...allAttributes,
				dangerouslySetInnerHTML: { __html: children },
			});
		} else {
			// For JSX children, include them directly
			return h('is-land', allAttributes, children);
		}
	}

	// Client-only: render empty is-land that will be hydrated (unless SSR-only)
	if (shouldSkipHydration) {
		// For SSR-only components without children, render empty element
		return h('is-land', {
			id: islandId,
			'data-render-strategy': 'ssr-only',
			...(framework ? { 'data-framework': framework } : {}),
		});
	}

	return h('is-land', {
		id: islandId,
		'data-island': condition,
		'data-hydrate': bundlePath,
		'data-props': JSON.stringify(props),
		'data-render-strategy': 'hydrate',
		...(framework ? { 'data-framework': framework } : {}),
	});
}

/**
 * Universal renderIsland function - auto-detects framework and handles SSR + hydration
 *
 * This is the main function you should use - it automatically:
 * - Detects the component framework (Vue, Solid.js, Preact/React)
 * - Analyzes component for intelligent rendering strategy detection
 * - Handles server-side rendering when possible
 * - Falls back to client-only rendering when needed
 * - Returns the appropriate Island component
 */
export async function renderIsland({
	src,
	condition = 'on:client',
	props = {},
	children,
	ssr = condition !== 'on:client',
	framework,
	ssrOnly = false,
	renderOptions = {},
}: IslandProps): Promise<JSX.Element> {
	const startTime = performance.now();
	const logPrefix = `🏝️ [${src}]`;

	console.log(`${logPrefix} renderIsland called with:`, {
		src,
		ssr,
		condition,
		ssrOnly,
		hasChildren: !!children,
		propsKeys: Object.keys(props),
		renderOptions: Object.keys(renderOptions),
	});

	// Perform intelligent component analysis if not explicitly SSR-only
	let shouldSkipHydration = ssrOnly;
	let analysisReason = '';
	let analysisTime = 0;

	if (!ssrOnly && renderOptions.detectScripts !== false) {
		const analysisStart = performance.now();
		try {
			console.log(`${logPrefix} 🔍 Starting component analysis...`);
			// Try to analyze the component for intelligent rendering strategy
			const analysisResult = await analyzeComponentFile(src, renderOptions);
			shouldSkipHydration = !analysisResult.decision.shouldHydrate;
			analysisReason = analysisResult.decision.reason;
			analysisTime = performance.now() - analysisStart;

			console.log(`${logPrefix} 🔍 Component analysis completed in ${analysisTime.toFixed(2)}ms:`, {
				decision: shouldSkipHydration ? 'SSR-ONLY' : 'HYDRATE',
				reason: analysisReason,
				hasWarnings: !!analysisResult.decision.warnings?.length,
			});

			if (analysisResult.decision.warnings && analysisResult.decision.warnings.length > 0) {
				analysisResult.decision.warnings.forEach(warning =>
					console.warn(`${logPrefix} ⚠️ Analysis warning: ${warning}`)
				);
			}
		} catch (error) {
			analysisTime = performance.now() - analysisStart;
			console.warn(`${logPrefix} ⚠️ Component analysis failed after ${analysisTime.toFixed(2)}ms:`, error);
			// Continue with original logic on analysis failure
		}
	} else {
		console.log(
			`${logPrefix} ⏭️ Skipping component analysis (ssrOnly: ${ssrOnly}, detectScripts: ${renderOptions.detectScripts})`
		);
	}

	// If component is determined to be SSR-only, handle accordingly
	if (shouldSkipHydration) {
		const ssrOnlyStart = performance.now();
		console.log(`${logPrefix} 📄 Using SSR-only rendering (reason: ${analysisReason})`);

		// For SSR-only components, we still want to render them server-side if possible
		// but without hydration attributes
		if (ssr && !children) {
			console.log(`${logPrefix} 🔄 Attempting SSR-only component rendering...`);
			try {
				const result = await renderComponentSSROnly({ src, condition, props, renderOptions });
				const ssrOnlyTime = performance.now() - ssrOnlyStart;
				const totalTime = performance.now() - startTime;
				console.log(
					`${logPrefix} ✅ SSR-only rendering completed in ${ssrOnlyTime.toFixed(2)}ms (total: ${totalTime.toFixed(
						2
					)}ms)`
				);
				return result;
			} catch (error) {
				const ssrOnlyTime = performance.now() - ssrOnlyStart;
				const totalTime = performance.now() - startTime;
				console.warn(`${logPrefix} ❌ SSR failed for SSR-only component after ${ssrOnlyTime.toFixed(2)}ms:`, error);
				console.log(`${logPrefix} 🔄 Falling back to basic Island without hydration`);
				// Fall back to basic Island without hydration
				return Island({ src, condition, props, children: undefined, ssr: false, ssrOnly: true, renderOptions });
			}
		} else {
			const totalTime = performance.now() - startTime;
			console.log(`${logPrefix} 📄 Using basic Island with SSR-only flag (completed in ${totalTime.toFixed(2)}ms)`);
			// Use basic Island with SSR-only flag
			return Island({ src, condition, props, children, ssr, ssrOnly: true, renderOptions });
		}
	}

	// If SSR is disabled or we already have children, use basic Island
	if (!ssr || children) {
		const totalTime = performance.now() - startTime;
		console.log(
			`${logPrefix} 📄 Using basic Island (SSR disabled: ${!ssr}, has children: ${!!children}) - completed in ${totalTime.toFixed(
				2
			)}ms`
		);
		return Island({ src, condition, props, children, ssr, renderOptions });
	}

	// Determine framework (explicit or auto-detect)
	const frameworkDetectionStart = performance.now();
	let detectedFramework = 'unknown';

	try {
		// Use explicit framework if provided
		if (framework) {
			detectedFramework = framework;
			const frameworkDetectionTime = performance.now() - frameworkDetectionStart;
			console.log(`${logPrefix} 🎯 Using explicit framework: ${framework} (${frameworkDetectionTime.toFixed(2)}ms)`);
		} else {
			// Auto-detect framework based on file extension and content
			// Vue detection
			if (src.endsWith('.vue')) {
				detectedFramework = 'vue';
				const frameworkDetectionTime = performance.now() - frameworkDetectionStart;
				console.log(`${logPrefix} 🔍 Detected Vue component (${frameworkDetectionTime.toFixed(2)}ms)`);
			}
			// Svelte detection
			else if (src.endsWith('.svelte')) {
				detectedFramework = 'svelte';
				const frameworkDetectionTime = performance.now() - frameworkDetectionStart;
				console.log(`${logPrefix} 🔍 Detected Svelte component (${frameworkDetectionTime.toFixed(2)}ms)`);
			}
			// TypeScript/JavaScript files - need content analysis
			else if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
				detectedFramework = await detectFramework(src);
				const frameworkDetectionTime = performance.now() - frameworkDetectionStart;
				console.log(
					`${logPrefix} 🔍 Detected framework: ${detectedFramework} (${frameworkDetectionTime.toFixed(2)}ms)`
				);
			}
		}

		// Render based on determined framework
		let result: JSX.Element;
		switch (detectedFramework) {
			case 'vue':
				result = await renderVueComponent({ src, condition, props, ssr, renderOptions });
				break;
			case 'svelte':
				result = await renderSvelteComponent({ src, condition, props, ssr, renderOptions });
				break;
			case 'solid':
				result = await renderSolidComponent({ src, condition, props, ssr, renderOptions });
				break;
			case 'preact':
			case 'react':
			default:
				result = await renderPreactComponent({ src, condition, props, ssr, renderOptions });
				break;
		}

		const totalTime = performance.now() - startTime;
		console.log(`${logPrefix} ✅ ${detectedFramework} rendering completed in ${totalTime.toFixed(2)}ms`);
		return result;
	} catch (error) {
		const totalTime = performance.now() - startTime;
		console.error(`${logPrefix} ❌ Framework rendering failed after ${totalTime.toFixed(2)}ms:`, error);

		// Fallback to basic Island
		return Island({
			src,
			condition,
			props,
			children: undefined,
			ssr: false,
			framework: detectedFramework as any,
			renderOptions,
		});
	}
}

/**
 * Analyze component file for rendering strategy
 */
async function analyzeComponentFile(src: string, options: AnalyzerOptions = {}) {
	// Resolve the path first, then try variations
	const resolvedSrc = resolveIslandPath(src);

	// Create comprehensive path variations including framework-specific naming
	const baseName =
		src
			.split('/')
			.pop()
			?.replace(/\.(tsx|jsx)$/, '') || '';
	const pathVariations = [
		resolvedSrc.startsWith('/') ? resolvedSrc.substring(1) : resolvedSrc,
		src.startsWith('/') ? src.substring(1) : src,
		`examples/${baseName}.tsx`,
		`examples/${baseName}.solid.tsx`,
		`examples/${baseName}.preact.tsx`,
		`src/islands/${baseName}.tsx`,
		`src/islands/${baseName}.solid.tsx`,
		`src/islands/${baseName}.preact.tsx`,
		`islands/${baseName}.tsx`,
		`islands/${baseName}.solid.tsx`,
		`islands/${baseName}.preact.tsx`,
	];

	for (const pathVariation of pathVariations) {
		try {
			const content = await Deno.readTextFile(pathVariation);
			return analyzeComponentContent(pathVariation, content, options);
		} catch {
			// Continue to next path variation
			continue;
		}
	}

	throw new Error(`Component file not found: ${src}`);
}

/**
 * Render component with SSR-only strategy (no hydration)
 */
async function renderComponentSSROnly({
	src,
	condition,
	props,
	renderOptions,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	renderOptions: AnalyzerOptions;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting SSR-only rendering for: ${src}`);

	try {
		// Use the existing SSR rendering functions but with ssrOnly flag
		// This ensures proper handling of props, styles, and framework-specific features

		if (src.endsWith('.vue')) {
			return await renderVueComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
		}

		if (src.endsWith('.svelte')) {
			return await renderSvelteComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
		}

		if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
			const framework = await detectFramework(src);

			switch (framework) {
				case 'solid':
					return await renderSolidComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
				case 'vue':
					return await renderVueComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
				case 'preact':
				case 'react':
				default:
					return await renderPreactComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
			}
		}

		// Unknown file type, return empty SSR-only Island
		return Island({ src, condition, props, children: undefined, ssr: false, ssrOnly: true, renderOptions });
	} catch (error) {
		console.error(`❌ SSR-only rendering failed for ${src}:`, error);
		throw error;
	}
}

/**
 * Resolve Island component path for Vite SSR loading
 * Converts /islands/* paths to /src/islands/* for proper resolution
 * Also handles framework-specific naming conventions
 */
function resolveIslandPath(src: string): string {
	let resolvedPath = src;

	// If path starts with /islands/, convert to /src/islands/
	if (src.startsWith('/islands/')) {
		resolvedPath = src.replace('/islands/', '/src/islands/');
	}

	// If path already starts with /src/islands/, use as-is
	if (src.startsWith('/src/islands/')) {
		resolvedPath = src;
	}

	// Handle framework-specific naming conventions
	// If the path doesn't have a framework-specific extension, try to find the actual file
	if (resolvedPath.endsWith('.tsx') && !resolvedPath.includes('.solid.') && !resolvedPath.includes('.preact.')) {
		// Try to find the actual file with framework-specific naming
		const basePath = resolvedPath.replace('.tsx', '');
		const possiblePaths = [
			`${basePath}.solid.tsx`,
			`${basePath}.preact.tsx`,
			resolvedPath, // Original path as fallback
		];

		// Check which file actually exists (synchronously for performance)
		for (const possiblePath of possiblePaths) {
			try {
				// Try multiple base directories
				const pathVariations = [
					possiblePath.startsWith('/') ? possiblePath.substring(1) : possiblePath,
					possiblePath.startsWith('/') ? `Avalon${possiblePath}` : `Avalon/${possiblePath}`,
				];

				for (const pathVariation of pathVariations) {
					try {
						Deno.statSync(pathVariation);
						return possiblePath;
					} catch {
						continue;
					}
				}
			} catch {
				// File doesn't exist, continue to next possibility
				continue;
			}
		}
	}

	return resolvedPath;
}

/**
 * Detect the framework used by a component file
 */
async function detectFramework(src: string): Promise<'solid' | 'vue' | 'preact' | 'react' | 'unknown'> {
	const logPrefix = `🔍 [${src}]`;
	const detectionStart = performance.now();

	console.log(`${logPrefix} Starting framework detection...`);

	// Quick filename-based detection
	if (src.includes('.solid.') || src.includes('Solid') || src.toLowerCase().includes('solid')) {
		const detectionTime = performance.now() - detectionStart;
		console.log(`${logPrefix} Framework detected via filename: solid (${detectionTime.toFixed(2)}ms)`);
		return 'solid';
	}

	if (src.includes('.vue.') || src.includes('Vue')) {
		const detectionTime = performance.now() - detectionStart;
		console.log(`${logPrefix} Framework detected via filename: vue (${detectionTime.toFixed(2)}ms)`);
		return 'vue';
	}

	// Try to read file content for more accurate detection
	try {
		let fileContent: string;
		let contentSource = '';

		try {
			// Try to read the file directly using resolved path
			const resolvedPath = resolveIslandPath(src);
			const filePath = resolvedPath.replace(/^\//, '');
			console.log(`${logPrefix} Attempting direct file read: ${src} -> ${filePath}`);
			fileContent = await Deno.readTextFile(filePath);
			contentSource = 'direct file read';
		} catch (fileError) {
			console.log(`${logPrefix} Direct file read failed, trying Vite SSR:`, fileError);
			// If direct read fails, try through Vite in development
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const resolvedPath = resolveIslandPath(src);
				console.log(`${logPrefix} Using Vite SSR module loading: ${src} -> ${resolvedPath}`);
				const module = await viteServer.ssrLoadModule(resolvedPath);
				fileContent = module.toString();
				contentSource = 'Vite SSR module';
			} else {
				console.log(`${logPrefix} No Vite server available, cannot detect framework`);
				return 'unknown';
			}
		}

		console.log(`${logPrefix} File content loaded via ${contentSource} (${fileContent.length} chars)`);

		// Check imports and pragmas
		const checks = [
			{ pattern: /solid-js|@jsxImportSource solid-js/, framework: 'solid' as const },
			{ pattern: /vue|Vue/, framework: 'vue' as const },
			{ pattern: /react/, framework: 'react' as const },
			{ pattern: /preact/, framework: 'preact' as const },
		];

		for (const check of checks) {
			if (check.pattern.test(fileContent)) {
				const detectionTime = performance.now() - detectionStart;
				console.log(
					`${logPrefix} Framework detected via content analysis: ${check.framework} (${detectionTime.toFixed(2)}ms)`
				);
				return check.framework;
			}
		}

		// Default to preact for JSX files
		const detectionTime = performance.now() - detectionStart;
		console.log(`${logPrefix} No specific framework detected, defaulting to preact (${detectionTime.toFixed(2)}ms)`);
		return 'preact';
	} catch (error) {
		const detectionTime = performance.now() - detectionStart;
		console.warn(`${logPrefix} Framework detection failed after ${detectionTime.toFixed(2)}ms:`, error);
		return 'unknown';
	}
}

/**
 * Render Vue component with SSR
 */
async function renderVueComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	const logPrefix = `🔄 [Vue:${src}]`;
	const renderStart = performance.now();

	console.log(`${logPrefix} Starting Vue SSR rendering...`, {
		ssrOnly,
		propsKeys: Object.keys(props),
		isDev: Deno.env.get('DENO_ENV') !== 'production',
	});

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';
		let moduleLoadTime = 0;
		let moduleSource = '';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const moduleStart = performance.now();
				const resolvedPath = resolveIslandPath(src);
				console.log(`${logPrefix} 📡 Loading via Vite SSR: ${src} -> ${resolvedPath}`);
				const module = await viteServer.ssrLoadModule(resolvedPath);
				moduleLoadTime = performance.now() - moduleStart;
				moduleSource = 'Vite SSR';

				const VueComponent = module.default || module;
				console.log(`${logPrefix} ✅ Module loaded via ${moduleSource} in ${moduleLoadTime.toFixed(2)}ms`, {
					hasDefault: !!module.default,
					moduleKeys: Object.keys(module),
					componentType: typeof VueComponent,
				});

				const result = await renderVueToString(VueComponent, props, src, condition, ssrOnly, renderOptions);
				const totalTime = performance.now() - renderStart;
				console.log(
					`${logPrefix} ✅ Vue SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`
				);
				return result;
			} else {
				console.log(`${logPrefix} ❌ No Vite server available in development mode`);
				throw new Error('No Vite server available for Vue SSR in development');
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.vue', '.js');
			const moduleStart = performance.now();
			console.log(`${logPrefix} 📦 Loading production SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			moduleLoadTime = performance.now() - moduleStart;
			moduleSource = 'production bundle';

			const VueComponent = module.default || module;
			console.log(`${logPrefix} ✅ Module loaded via ${moduleSource} in ${moduleLoadTime.toFixed(2)}ms`);

			const result = await renderVueToString(VueComponent, props, src, condition, ssrOnly, renderOptions);
			const totalTime = performance.now() - renderStart;
			console.log(
				`${logPrefix} ✅ Vue SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`
			);
			return result;
		}
	} catch (error) {
		const failTime = performance.now() - renderStart;
		console.error(`${logPrefix} ❌ Vue SSR failed after ${failTime.toFixed(2)}ms:`, error);
	}

	// For SSR-only components, try template-based fallback
	if (ssrOnly) {
		const fallbackStart = performance.now();
		console.log(`${logPrefix} 🔄 Trying template-based fallback for SSR-only component...`);
		try {
			const templateFallback = await renderVueTemplateFallback(src, props, condition, renderOptions);
			const fallbackTime = performance.now() - fallbackStart;

			if (templateFallback) {
				const totalTime = performance.now() - renderStart;
				console.log(
					`${logPrefix} ✅ Vue template fallback succeeded in ${fallbackTime.toFixed(2)}ms (total: ${totalTime.toFixed(
						2
					)}ms)`
				);
				return templateFallback;
			} else {
				console.log(`${logPrefix} ⚠️ Vue template fallback returned null after ${fallbackTime.toFixed(2)}ms`);
			}
		} catch (fallbackError) {
			const fallbackTime = performance.now() - fallbackStart;
			console.error(`${logPrefix} ❌ Vue template fallback failed after ${fallbackTime.toFixed(2)}ms:`, fallbackError);
		}
	}

	// Extract CSS even when SSR fails
	let fallbackCSS = '';
	try {
		// Try different path variations to find the Vue file
		const pathVariations = [
			src.startsWith('/') ? `Avalon/src${src}` : `Avalon/${src}`,
			src.startsWith('/') ? `./Avalon/src${src}` : `./Avalon/${src}`,
			src.startsWith('/') ? `src${src}` : src,
			src.replace('/islands/', '/src/islands/'),
		];

		let vueContent = '';
		for (const path of pathVariations) {
			try {
				vueContent = await Deno.readTextFile(path);
				console.log(`📁 Vue file found at: ${path}`);
				break;
			} catch {
				continue;
			}
		}

		if (!vueContent) {
			throw new Error(`Vue file not found in any of the attempted paths: ${pathVariations.join(', ')}`);
		}

		// Extract style blocks using regex
		const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
		let match;

		while ((match = styleRegex.exec(vueContent)) !== null) {
			const attributes = match[1];
			const content = match[2].trim();
			const isScoped = attributes.includes('scoped');

			if (isScoped) {
				// Generate a consistent scope ID for the component
				const scopeId = `data-v-${src.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

				// Apply scoping to CSS selectors
				const scopedCSS = content.replace(/([^{}]+){/g, (match, selector) => {
					const trimmedSelector = selector.trim();
					// Skip @media, @keyframes, etc.
					if (trimmedSelector.startsWith('@')) {
						return match;
					}
					// Add scope attribute to each selector
					return `${trimmedSelector}[${scopeId}] {`;
				});

				fallbackCSS += scopedCSS;
				console.log(`📝 Vue scoped CSS extracted in fallback for ${src}`);
			} else {
				// Non-scoped styles
				fallbackCSS += content;
				console.log(`📝 Vue global CSS extracted in fallback for ${src}`);
			}
		}
	} catch (error) {
		console.warn(`⚠️ Failed to extract CSS in Vue fallback for ${src}:`, error);
	}

	// Fallback to client-only (or SSR-only if specified) with CSS
	const totalTime = performance.now() - renderStart;
	const fallbackMode = ssrOnly ? 'SSR-only' : 'client-only';
	console.log(`${logPrefix} 🔄 Falling back to ${fallbackMode} Island after ${totalTime.toFixed(2)}ms`);

	// Include CSS in the fallback if found
	const children = fallbackCSS ? `<style data-vue-ssr-id="fallback">${fallbackCSS}</style>` : undefined;

	// Use ssr: true when we have CSS children to include
	const shouldUseSSR = !!children;

	return Island({ src, condition, props, ssr: shouldUseSSR, ssrOnly, renderOptions, children });
}

/**
 * Render Solid component with SSR
 */
async function renderSolidComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Solid SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule if available
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const resolvedPath = resolveIslandPath(src);
				console.log(`📡 Loading Solid component: ${src} -> ${resolvedPath}`);
				const module = await viteServer.ssrLoadModule(resolvedPath);
				const SolidComponent = module.default || module;

				if (!SolidComponent || typeof SolidComponent !== 'function') {
					throw new Error(`Invalid Solid component in ${src}`);
				}

				return await renderSolidToString(SolidComponent, props, src, condition);
			} else {
				// Fallback: try direct import when no Vite server is available
				console.log(`⚠️ No Vite server available, attempting direct import for ${src}`);
				const resolvedPath = resolveIslandPath(src);
				// Convert to relative path for import, accounting for Avalon directory structure
				let filePath = resolvedPath.startsWith('/') ? `.${resolvedPath}` : `./${resolvedPath}`;

				// If the path doesn't exist, try with Avalon prefix
				try {
					await Deno.stat(filePath.substring(2)); // Remove './' to check if file exists
				} catch {
					// File doesn't exist at the standard path, try with Avalon prefix
					if (resolvedPath.startsWith('/src/')) {
						filePath = `./Avalon${resolvedPath}`;
					}
				}

				try {
					const module = await import(filePath);
					const SolidComponent = module.default || module;

					if (!SolidComponent || typeof SolidComponent !== 'function') {
						throw new Error(`Invalid Solid component in ${src}`);
					}

					return await renderSolidToString(SolidComponent, props, src, condition);
				} catch (importError) {
					console.error(`❌ Direct import failed for ${src}:`, importError);
					throw importError;
				}
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx)$/, '.js');
			console.log(`📦 Loading Solid SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const SolidComponent = module.default || module;
			return await renderSolidToString(SolidComponent, props, src, condition);
		}
	} catch (error) {
		console.error(`❌ Solid SSR failed for ${src}:`, error);
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Solid SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({ src, condition, props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Svelte component with SSR
 */
async function renderSvelteComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Svelte SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const resolvedPath = resolveIslandPath(src);
				console.log(`📡 Loading Svelte component: ${src} -> ${resolvedPath}`);
				const module = await viteServer.ssrLoadModule(resolvedPath);
				const SvelteComponent = module.default || module;

				if (!SvelteComponent || typeof SvelteComponent.render !== 'function') {
					throw new Error(`Invalid Svelte component in ${src}`);
				}

				return await renderSvelteToString(SvelteComponent, props, src, condition, ssrOnly, renderOptions);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.svelte', '.js');
			console.log(`📦 Loading Svelte SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const SvelteComponent = module.default || module;
			return await renderSvelteToString(SvelteComponent, props, src, condition, ssrOnly, renderOptions);
		}
	} catch (error) {
		console.error(`❌ Svelte SSR failed for ${src}:`, error);
		console.log(`🔍 ssrOnly flag is: ${ssrOnly}`);

		// For SSR-only components, try template-based fallback
		if (ssrOnly) {
			console.log(`🔄 Trying template-based fallback for SSR-only component: ${src}`);
			try {
				const templateFallback = await renderSvelteTemplateFallback(src, props, condition, renderOptions);
				if (templateFallback) {
					console.log(`✅ Template fallback succeeded, returning result`);
					return templateFallback;
				} else {
					console.log(`⚠️ Template fallback returned null`);
				}
			} catch (fallbackError) {
				console.error(`❌ Template fallback failed:`, fallbackError);
			}
		}
	}

	// For SSR-only components, try template-based fallback
	if (ssrOnly) {
		console.log(`🔄 Trying template-based fallback for SSR-only Svelte component: ${src}`);
		try {
			const templateFallback = await renderSvelteTemplateFallback(src, props, condition, renderOptions);
			if (templateFallback) {
				console.log(`✅ Svelte template fallback succeeded, returning result`);
				return templateFallback;
			} else {
				console.log(`⚠️ Svelte template fallback returned null`);
			}
		} catch (fallbackError) {
			console.error(`❌ Svelte template fallback failed:`, fallbackError);
		}
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Svelte SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({
		src,
		condition,
		props,
		ssr: false,
		framework: 'svelte',
		ssrOnly,
		renderOptions,
	});
}

/**
 * Render Preact component with SSR
 */
async function renderPreactComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	const logPrefix = `🔄 [Preact:${src}]`;
	const renderStart = performance.now();

	console.log(`${logPrefix} Starting Preact SSR rendering...`, {
		ssrOnly,
		propsKeys: Object.keys(props),
		isDev: Deno.env.get('DENO_ENV') !== 'production',
	});

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';
		let moduleLoadTime = 0;
		let moduleSource = '';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const moduleStart = performance.now();
				const resolvedPath = resolveIslandPath(src);
				console.log(`${logPrefix} 📡 Loading via Vite SSR: ${src} -> ${resolvedPath}`);
				const module = await viteServer.ssrLoadModule(resolvedPath);
				moduleLoadTime = performance.now() - moduleStart;
				moduleSource = 'Vite SSR';

				const PreactComponent = module.default || module;

				console.log(`${logPrefix} ✅ Module loaded via ${moduleSource} in ${moduleLoadTime.toFixed(2)}ms`, {
					hasDefault: !!module.default,
					moduleKeys: Object.keys(module),
					componentType: typeof PreactComponent,
					isFunction: typeof PreactComponent === 'function',
				});

				if (!PreactComponent || typeof PreactComponent !== 'function') {
					throw new Error(`Invalid Preact component in ${src}: expected function, got ${typeof PreactComponent}`);
				}

				const result = renderPreactToString(PreactComponent, props, src, condition, ssrOnly, renderOptions);
				const totalTime = performance.now() - renderStart;
				console.log(
					`${logPrefix} ✅ Preact SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`
				);
				return result;
			} else {
				console.log(`${logPrefix} ❌ No Vite server available in development mode`);
				throw new Error('No Vite server available for Preact SSR in development');
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx)$/, '.js');
			const moduleStart = performance.now();
			console.log(`${logPrefix} 📦 Loading production SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			moduleLoadTime = performance.now() - moduleStart;
			moduleSource = 'production bundle';

			const PreactComponent = module.default || module;
			console.log(`${logPrefix} ✅ Module loaded via ${moduleSource} in ${moduleLoadTime.toFixed(2)}ms`);

			const result = renderPreactToString(PreactComponent, props, src, condition, ssrOnly, renderOptions);
			const totalTime = performance.now() - renderStart;
			console.log(
				`${logPrefix} ✅ Preact SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`
			);
			return result;
		}
	} catch (error) {
		const failTime = performance.now() - renderStart;
		console.error(`${logPrefix} ❌ Preact SSR failed after ${failTime.toFixed(2)}ms:`, error);
	}

	// Fallback to client-only (or SSR-only if specified)
	const totalTime = performance.now() - renderStart;
	const fallbackMode = ssrOnly ? 'SSR-only' : 'client-only';
	console.log(`${logPrefix} 🔄 Falling back to ${fallbackMode} Island after ${totalTime.toFixed(2)}ms`);
	return Island({ src, condition, props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Preact component to string
 */
function renderPreactToString(
	component: () => JSX.Element,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): JSX.Element {
	const logPrefix = `🔄 [PreactRender:${src}]`;
	const renderStart = performance.now();

	console.log(`${logPrefix} Starting Preact renderToString...`, {
		componentType: typeof component,
		propsKeys: Object.keys(props),
		ssrOnly,
	});

	try {
		// Render component directly, then add hydration attributes
		const renderStringStart = performance.now();
		const ssrHtml = renderToString(h(component, props));
		const renderStringTime = performance.now() - renderStringStart;

		console.log(`${logPrefix} ✅ Preact renderToString completed in ${renderStringTime.toFixed(2)}ms`, {
			htmlLength: ssrHtml.length,
			htmlPreview: ssrHtml.substring(0, 100) + (ssrHtml.length > 100 ? '...' : ''),
		});

		const result = Island({
			src,
			condition,
			props,
			children: ssrHtml,
			ssr: true,
			framework: 'preact',
			ssrOnly,
			renderOptions,
		});

		const totalTime = performance.now() - renderStart;
		console.log(`${logPrefix} ✅ Island creation completed in ${totalTime.toFixed(2)}ms`);
		return result;
	} catch (error) {
		const failTime = performance.now() - renderStart;
		console.error(`${logPrefix} ❌ Preact renderToString failed after ${failTime.toFixed(2)}ms:`, error);

		console.log(`${logPrefix} 🔄 Creating fallback Island without SSR`);
		return Island({
			src,
			condition: ssrOnly ? condition : 'on:client',
			props,
			ssr: false,
			framework: 'preact',
			ssrOnly,
			renderOptions,
		});
	}
}

/**
 * Render Vue component to string with proper SSR/hydration setup
 *
 * Based on Vue.js SSR documentation and Astro's Vue integration:
 * - Creates proper SSR app with createSSRApp
 * - Wraps SSR HTML in a div with data-server-rendered="true"
 * - Uses consistent container structure for client hydration
 */
async function renderVueToString(
	VueComponent: Record<string, unknown>,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): Promise<JSX.Element> {
	try {
		// CRITICAL FIX: Import the dedicated Vue server renderer.
		// This ensures the server-generated HTML is compatible with client hydration.
		const { renderToString: vueRenderToString } = await import('vue/server-renderer');
		const { createSSRApp } = await import('vue');

		// Create a new Vue app instance for each server-side render
		const app = createSSRApp(VueComponent, props);

		// Render the Vue component
		const ssrHtml = await vueRenderToString(app);

		console.log(`✅ Vue component rendered successfully with vue/server-renderer for ${src}`);

		// Extract CSS directly from Vue component file
		let componentCSS = '';
		try {
			// Try different path variations to find the Vue file
			const pathVariations = [
				src.startsWith('/') ? `Avalon/src${src}` : `Avalon/${src}`,
				src.startsWith('/') ? `./Avalon/src${src}` : `./Avalon/${src}`,
				src.startsWith('/') ? `src${src}` : src,
				src.replace('/islands/', '/src/islands/'),
			];

			let vueContent = '';
			for (const path of pathVariations) {
				try {
					vueContent = await Deno.readTextFile(path);
					console.log(`📁 Vue file found at: ${path}`);
					break;
				} catch {
					continue;
				}
			}

			if (!vueContent) {
				throw new Error(`Vue file not found in any of the attempted paths: ${pathVariations.join(', ')}`);
			}

			// Extract style blocks using regex
			const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
			let match;

			while ((match = styleRegex.exec(vueContent)) !== null) {
				const attributes = match[1];
				const content = match[2].trim();
				const isScoped = attributes.includes('scoped');

				if (isScoped) {
					// Generate a consistent scope ID for the component
					const scopeId = `data-v-${src.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

					// Apply scoping to CSS selectors
					const scopedCSS = content.replace(/([^{}]+){/g, (match, selector) => {
						const trimmedSelector = selector.trim();
						// Skip @media, @keyframes, etc.
						if (trimmedSelector.startsWith('@')) {
							return match;
						}
						// Add scope attribute to each selector
						return `${trimmedSelector}[${scopeId}] {`;
					});

					componentCSS += scopedCSS;
					console.log(`📝 Vue scoped CSS extracted and processed for ${src}`);
				} else {
					// Non-scoped styles
					componentCSS += content;
					console.log(`📝 Vue global CSS extracted for ${src}`);
				}
			}
		} catch (error) {
			console.warn(`⚠️ Failed to extract CSS from Vue file ${src}:`, error);
		}

		// Include CSS and apply scoping if found
		let styledContent = ssrHtml;
		if (componentCSS) {
			// Generate a consistent scope ID for the component
			const scopeId = `data-v-${src.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

			// Add scope attributes to HTML elements
			const scopedHtml = ssrHtml.replace(/<([a-zA-Z][^>]*?)>/g, (match, tagContent) => {
				// Skip closing tags and self-closing tags
				if (tagContent.startsWith('/') || tagContent.endsWith('/')) {
					return match;
				}
				// Add scope attribute
				return `<${tagContent} ${scopeId}>`;
			});

			styledContent = `<style data-vue-ssr-id="${scopeId}">${componentCSS}</style>${scopedHtml}`;
			console.log(`📝 Vue component CSS extracted and scoped: ${componentCSS.length} chars`);
		} else {
			console.log(`⚠️ No CSS extracted for Vue component ${src}`);
		}

		// Use Island component with proper SSR-only handling
		return Island({
			src,
			condition,
			props,
			children: styledContent,
			ssr: true,
			ssrOnly,
			renderOptions,
		});
	} catch (error: unknown) {
		console.error(`❌ Vue renderToString failed for ${src}:`, error);
		throw `❌ Vue renderToString failed for ${src}: ${error}`;
	}
}

/**
 * Render Solid component using proper SSR approach with semantic is-land element
 */
async function renderSolidToString(
	SolidComponent: (props: Record<string, unknown>) => unknown,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client'
): Promise<JSX.Element> {
	try {
		console.log(`🔄 Rendering Solid component to string for ${src}`);

		// Import Solid.js SSR utilities
		let renderToStringAsync: (fn: () => unknown) => Promise<string>;

		try {
			const solidWeb = await import('solid-js/web');
			renderToStringAsync = (solidWeb.renderToStringAsync ||
				solidWeb.default?.renderToStringAsync) as typeof renderToStringAsync;

			if (!renderToStringAsync) {
				// Fallback to synchronous renderToString
				const renderToString = (solidWeb.renderToString || solidWeb.default?.renderToString) as (
					fn: () => unknown
				) => string;
				if (!renderToString) {
					throw new Error('Neither renderToStringAsync nor renderToString found in solid-js/web import');
				}
				renderToStringAsync = fn => Promise.resolve(renderToString(fn));
			}
		} catch (importError: unknown) {
			console.error(`Failed to import solid-js/web:`, importError);
			const errorMessage = importError instanceof Error ? importError.message : String(importError);
			throw new Error(`Cannot import solid-js/web: ${errorMessage}`);
		}

		console.log(`📦 Successfully imported solid-js/web for ${src}`);

		// Validate component
		if (typeof SolidComponent !== 'function') {
			throw new Error(`Expected SolidComponent to be a function, got ${typeof SolidComponent}`);
		}

		// Render the component - SolidJS will add its own hydration markers
		const ssrHtml = await renderToStringAsync(() => SolidComponent(props));

		if (!ssrHtml || typeof ssrHtml !== 'string') {
			throw new Error(`renderToStringAsync returned invalid result: ${typeof ssrHtml}`);
		}

		console.log(`✅ Solid component rendered successfully for ${src}, HTML length: ${ssrHtml.length}`);

		// Generate deterministic container ID (SSR-safe)
		const containerId = `solid-island-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;

		// Resolve the path for hydration - ensure it matches what Vite can serve
		const hydrationPath = resolveIslandPath(src);

		// Use semantic is-land element with dedicated Solid hydration attributes
		return h('is-land', {
			id: containerId,
			'data-solid-hydrate': hydrationPath,
			'data-solid-props': JSON.stringify(props),
			'data-solid-condition': condition,
			dangerouslySetInnerHTML: { __html: ssrHtml },
		});
	} catch (error: unknown) {
		console.error(`❌ Solid SSR failed for ${src}:`, error);
		throw `❌ Solid renderToString failed for ${src}: ${error}`;
	}
}

/**
 * Render Svelte component to string using Svelte 5 SSR approach
 */
async function renderSvelteToString(
	SvelteComponent: Component,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): Promise<JSX.Element> {
	try {
		console.log(`🔄 Rendering Svelte component to string for ${src}`);

		// Import Svelte 5 render function
		const { render } = await import('svelte/server');
		console.log(`📦 Using Svelte 5 render from svelte/server`);

		// Use Svelte 5 render API
		console.log(`🔍 About to call Svelte render() for ${src}`);
		const result = render(SvelteComponent, { props });
		console.log(`🔍 Svelte render() result:`, {
			hasBody: !!result.body,
			bodyType: typeof result.body,
			bodyLength: result.body?.length,
			hasHead: !!result.head,
			headType: typeof result.head,
			headLength: result.head?.length,
			resultKeys: Object.keys(result),
		});

		const ssrHtml = result.body; // Svelte 5 returns { body, head }
		const ssrHead = result.head; // Contains CSS and other head content

		// Log the head content for debugging
		if (ssrHead) {
			console.log(`📝 Svelte component has head content: ${ssrHead.length} chars`);
			console.log(`📝 Head content preview:`, ssrHead.substring(0, 300));

			// Collect CSS globally for document head injection
			if (globalThis.__svelteSSRCSS && ssrHead.trim()) {
				globalThis.__svelteSSRCSS.add(ssrHead);
				console.log(`📝 Added Svelte CSS to global collector, total styles: ${globalThis.__svelteSSRCSS.size}`);
			}
		} else {
			console.log(`⚠️ No head content from Svelte SSR - this is the problem!`);
		}

		if (!ssrHtml || typeof ssrHtml !== 'string') {
			throw new Error(`Svelte render returned invalid HTML: ${typeof ssrHtml}`);
		}

		console.log(`✅ Svelte component rendered successfully for ${src}, HTML length: ${ssrHtml.length}`);
		console.log(`📝 Body HTML preview:`, ssrHtml.substring(0, 300));

		// For now, let's include the CSS inline to ensure it works
		// This is not ideal but will help us debug
		const styledContent = ssrHead ? `${ssrHead}${ssrHtml}` : ssrHtml;

		// Return Island component with SSR content and Svelte-specific attributes
		return Island({
			src,
			condition,
			props,
			children: styledContent, // Include CSS inline for now
			ssr: true,
			framework: 'svelte',
			ssrOnly,
			renderOptions,
		});
	} catch (error: unknown) {
		console.error(`❌ Svelte SSR failed for ${src}:`, error);
		throw `❌ Svelte renderToString failed for ${src}: ${error}`;
	}
}
/**
 * Template-based fallback for Svelte SSR-only components when full SSR fails
 * This handles props and styles properly without requiring a full Svelte runtime
 */
async function renderSvelteTemplateFallback(
	src: string,
	props: Record<string, unknown>,
	condition: IslandProps['condition'],
	renderOptions: AnalyzerOptions
): Promise<JSX.Element | null> {
	try {
		// Resolve the path first, then try variations
		const resolvedSrc = resolveIslandPath(src);
		const pathVariations = [
			resolvedSrc.startsWith('/') ? resolvedSrc.substring(1) : resolvedSrc,
			src.startsWith('/') ? src.substring(1) : src,
			`examples/${src.split('/').pop()}`,
			`src/islands/${src.split('/').pop()}`,
			`islands/${src.split('/').pop()}`,
		];

		let componentContent = '';
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);
				break;
			} catch {
				continue;
			}
		}

		if (!componentContent) {
			return null;
		}

		// Parse the Svelte component more carefully
		const result = parseSvelteComponent(componentContent, props);

		if (!result.template) {
			return null;
		}

		// Combine styles and template
		let content = result.template;
		if (result.styles) {
			content = `<style>${result.styles}</style>${result.template}`;
		}

		console.log(`✅ Svelte template fallback successful for ${src}`);

		return Island({
			src,
			condition,
			props,
			children: content,
			ssr: true,
			framework: 'svelte',
			ssrOnly: true,
			renderOptions,
		});
	} catch (error) {
		console.warn(`Svelte template fallback failed for ${src}:`, error);
		return null;
	}
}

/**
 * Parse Svelte component and handle props/styles properly
 */
function parseSvelteComponent(
	content: string,
	props: Record<string, unknown>
): {
	template: string;
	styles: string;
} {
	// Extract styles first
	const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
	let styles = '';
	if (styleMatches) {
		styles = styleMatches
			.map(match => {
				const styleContent = match.replace(/<\/?style[^>]*>/gi, '');
				return styleContent.trim();
			})
			.join('\n');
	}

	// Remove script and style sections to get template
	let template = content
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script sections
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style sections
		.trim();

	// Handle prop interpolation more intelligently
	for (const [key, value] of Object.entries(props)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			// Replace {prop} with the actual value
			template = template.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), String(value));
		}
	}

	// Handle common Svelte patterns for static rendering
	template = template
		// Remove remaining expressions but preserve the structure
		.replace(/\{[^}]*\}/g, '')
		// Remove event handlers but keep the element structure
		.replace(/\s*on:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove bindings
		.replace(/\s*bind:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove actions
		.replace(/\s*use:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove class directives
		.replace(/\s*class:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Clean up extra whitespace
		.replace(/\s+/g, ' ')
		.trim();

	return { template, styles };
}
/**
 * Template-based fallback for Vue SSR-only components when full SSR fails
 */
async function renderVueTemplateFallback(
	src: string,
	props: Record<string, unknown>,
	condition: IslandProps['condition'],
	renderOptions: AnalyzerOptions
): Promise<JSX.Element | null> {
	try {
		// Resolve the path first, then try variations
		const resolvedSrc = resolveIslandPath(src);
		const pathVariations = [
			resolvedSrc.startsWith('/') ? resolvedSrc.substring(1) : resolvedSrc,
			src.startsWith('/') ? src.substring(1) : src,
			`examples/${src.split('/').pop()}`,
			`src/islands/${src.split('/').pop()}`,
			`islands/${src.split('/').pop()}`,
		];

		let componentContent = '';
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);
				break;
			} catch {
				continue;
			}
		}

		if (!componentContent) {
			return null;
		}

		// Parse the Vue component
		const result = parseVueComponent(componentContent, props);

		if (!result.template) {
			return null;
		}

		// Combine styles and template
		let content = result.template;
		if (result.styles) {
			content = `<style>${result.styles}</style>${result.template}`;
		}

		console.log(`✅ Vue template fallback successful for ${src}`);

		return Island({
			src,
			condition,
			props,
			children: content,
			ssr: true,
			ssrOnly: true,
			renderOptions,
		});
	} catch (error) {
		console.warn(`Vue template fallback failed for ${src}:`, error);
		return null;
	}
}

/**
 * Parse Vue component and handle props/styles properly
 */
function parseVueComponent(
	content: string,
	props: Record<string, unknown>
): {
	template: string;
	styles: string;
} {
	// Extract template content
	const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
	if (!templateMatch) {
		return { template: '', styles: '' };
	}

	let template = templateMatch[1].trim();

	// Extract styles
	const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
	let styles = '';
	if (styleMatches) {
		styles = styleMatches
			.map(match => {
				const styleContent = match.replace(/<\/?style[^>]*>/gi, '');
				return styleContent.trim();
			})
			.join('\n');
	}

	// Handle prop interpolation for Vue - replace {{prop}} patterns
	for (const [key, value] of Object.entries(props)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			// Replace {{prop}} with the actual value
			template = template.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
		}
	}

	// Remove remaining Vue directives and interpolations for static rendering
	template = template
		// Remove remaining interpolations
		.replace(/\{\{[^}]*\}\}/g, '')
		// Remove Vue directives but keep the element structure
		.replace(/\s*v-[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*v-[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Remove event handlers
		.replace(/\s*@[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*@[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Remove prop bindings
		.replace(/\s*:[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*:[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Clean up extra whitespace
		.replace(/\s+/g, ' ')
		.trim();

	return { template, styles };
}
