/**
 * Lit Server-Side Rendering
 *
 * Handles SSR of Lit components using @lit-labs/ssr.
 * DOM shim MUST be imported first, before any Lit modules.
 */

import { LitElementRenderer } from "@lit-labs/ssr/lib/lit-element-renderer.js";
import { collectResultSync } from "@lit-labs/ssr/lib/render-result.js";
import type { LitElement } from "lit";
import type { LitRenderParams, LitRenderResult } from "../types.ts";
import { verifyDOMShim, waitForDOMShim } from "./dom-shim.ts";
import {
	collectStyles,
	extractTagNameFromSource,
	getTagName,
	loadComponent,
	serializeAttributes,
} from "./utils.ts";

if (!verifyDOMShim()) {
	throw new Error("Lit DOM shim is not properly installed");
}

/**
 * Convert a camelCase prop name to the attribute name the Lit element expects.
 * Checks the element's static `properties` map for an explicit `attribute`
 * mapping; falls back to camelCase → kebab-case conversion.
 */
function propToAttribute(ElementClass: typeof LitElement, propName: string): string | null {
	const propDefs = (
		ElementClass as unknown as { properties?: Record<string, { attribute?: string | boolean }> }
	).properties;

	if (propDefs && propName in propDefs) {
		const def = propDefs[propName];
		if (def.attribute === false) return null; // property-only, no attribute
		if (typeof def.attribute === "string") return def.attribute;
	}

	// Default: camelCase → kebab-case
	return propName.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Render a Lit element using @lit-labs/ssr's LitElementRenderer directly.
 *
 * The previous approach used `unsafeStatic(attrsString)` inside a tagged
 * template literal.  That bakes attributes into the template's *static text*,
 * so @lit-labs/ssr never calls `setAttribute` → `attributeChangedCallback` →
 * `attributeToProperty` on the element instance.  Properties therefore stay at
 * their class-field defaults (e.g. `count = 0`).
 *
 * By driving the renderer directly we can call `setAttribute` for every prop,
 * which feeds through the full Lit reactive pipeline before `render()` runs.
 */
function serializePropValue(value: unknown): string | null {
	if (typeof value === "boolean") return value ? "" : null;
	if (typeof value === "object" || Array.isArray(value)) return JSON.stringify(value);
	if (typeof value === "string" || typeof value === "number" || typeof value === "bigint")
		return String(value);
	return null; // skip symbols and other non-serializable types
}

function applyPropsToRenderer(
	renderer: LitElementRenderer,
	ElementClass: typeof LitElement,
	props: Record<string, unknown>,
): void {
	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null) continue;

		const attrName = propToAttribute(ElementClass, key);
		if (attrName === null) {
			if (renderer.element) {
				(renderer.element as unknown as Record<string, unknown>)[key] = value;
			}
			continue;
		}

		const strValue = serializePropValue(value);
		if (strValue !== null) renderer.setAttribute(attrName, strValue);
	}
}

function renderLitElementWithSSR(
	ElementClass: typeof LitElement,
	props: Record<string, unknown>,
	tagName: string,
): { html: string; styles: string } {
	// Ensure the element is registered (loadComponent side-effects may have
	// already done this, but be safe).
	if (!customElements.get(tagName)) {
		customElements.define(tagName, ElementClass as unknown as CustomElementConstructor);
	}

	// --- 1. Create the renderer (which internally does `new ElementClass()`) ---
	const renderer = new LitElementRenderer(tagName);

	// --- 2. Feed props as attributes so the reactive pipeline picks them up ---
	applyPropsToRenderer(renderer, ElementClass, props);

	// Always add defer-hydration for client-side hydration support
	renderer.setAttribute("defer-hydration", "");

	// --- 3. connectedCallback triggers willUpdate → update (reflects attrs) ---
	renderer.connectedCallback();

	// --- 4. Render shadow DOM content ---
	const renderInfo = {
		elementRenderers: [LitElementRenderer],
		customElementInstanceStack: [renderer] as Array<
			InstanceType<typeof LitElementRenderer> | undefined
		>,
		customElementHostStack: [renderer] as Array<
			InstanceType<typeof LitElementRenderer> | undefined
		>,
		eventTargetStack: [] as Array<HTMLElement | undefined>,
		slotStack: [] as Array<string | undefined>,
		deferHydration: false,
	};

	let shadowContent = "";
	const shadowResult = renderer.renderShadow(renderInfo);
	if (shadowResult) {
		shadowContent = collectResultSync(shadowResult);
	}

	// --- 5. Build the outer HTML with declarative shadow DOM ---
	const attrsHtml = collectResultSync(renderer.renderAttributes());

	const renderedHtml =
		`<${tagName}${attrsHtml}>` +
		`<template shadowrootmode="open">${shadowContent}</template>` +
		`</${tagName}>`;

	const styles = collectStyles(ElementClass);

	return { html: renderedHtml, styles };
}

/**
 * Fallback render - empty custom element tag
 */
function renderFallback(tagName: string, attributes: string): string {
	const attrs = attributes ? ` ${attributes}` : "";
	return `<${tagName}${attrs}></${tagName}>`;
}

/**
 * Render a Lit component on the server
 */
export async function render(params: LitRenderParams): Promise<LitRenderResult> {
	// Ensure linkedom DOM globals are ready before rendering
	await waitForDOMShim();

	const {
		component,
		props = {},
		src,
		ssrOnly = false,
		condition = "on:client",
		viteServer,
	} = params;

	// Try to load component for full SSR rendering
	let ElementClass: typeof LitElement | null = null;
	let styles = "";

	try {
		ElementClass = component || (await loadComponent(src, viteServer));
		styles = collectStyles(ElementClass);
	} catch (loadError) {
		// Component loading failed, will use fallback rendering
		if (process.env.NODE_ENV !== "production") {
			console.warn(`[Lit] Failed to load component from ${src}:`, loadError);
		}
		ElementClass = null;
	}

	// Extract tag name: prefer getting it from the class itself, fall back to source parsing
	let tagName: string | null = null;
	if (ElementClass) {
		try {
			tagName = getTagName(ElementClass);
		} catch {
			// getTagName failed, try source
		}
	}
	if (!tagName) {
		tagName = await extractTagNameFromSource(src);
	}

	if (!tagName) {
		throw new Error(
			`Could not extract tag name from ${src}. Ensure @customElement decorator uses a string literal.`,
		);
	}

	// Render HTML
	const attributes = serializeAttributes(props);
	let html: string;

	if (ElementClass) {
		try {
			const ssrResult = renderLitElementWithSSR(ElementClass, props, tagName);
			html = ssrResult.html;
			styles = ssrResult.styles;
		} catch (ssrError) {
			if (process.env.NODE_ENV !== "production") {
				console.warn(`[Lit] SSR failed for ${tagName}, using fallback:`, ssrError);
			}
			html = renderFallback(tagName, attributes);
		}
	} else {
		html = renderFallback(tagName, attributes);
	}

	// Build hydration data (unless SSR-only)
	const hydrationData = ssrOnly
		? undefined
		: {
				src,
				props,
				framework: "lit" as const,
				condition,
				metadata: { tagName },
			};

	return {
		html,
		css: styles || undefined,
		styles,
		shadowContent: html,
		hydrationData,
	};
}

/**
 * Render with error boundary - returns fallback on failure
 */
export async function renderWithErrorBoundary(
	params: LitRenderParams,
	fallback?: string,
): Promise<LitRenderResult> {
	try {
		return await render(params);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return {
			html: fallback || `<!-- Lit SSR failed: ${errorMessage.replaceAll("-->", "--&gt;")} -->`,
			hydrationData: {
				src: params.src,
				props: params.props || {},
				framework: "lit",
				metadata: { ssrFailed: true, errorMessage },
			},
		};
	}
}
