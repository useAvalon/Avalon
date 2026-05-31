/**
 * Lit Server Utilities
 */

// Import DOM shim FIRST before any Lit imports
import "./dom-shim.ts";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveIslandPath } from "@useavalon/avalon/islands/framework-detection";
import { toImportSpecifier } from "@useavalon/core/utils";
import type { CSSResult, LitElement } from "lit";

/**
 * Extract custom element tag name from a Lit component
 */
export function getTagName(ElementClass: typeof LitElement): string {
	// Check static properties set by various Lit patterns
	const tagName =
		(ElementClass as any).elementName ||
		(ElementClass as any).tagName ||
		(ElementClass as any)._tagName;

	if (tagName && typeof tagName === "string") {
		return tagName;
	}

	// Check __localName set by @lit-labs/ssr-dom-shim's CustomElementRegistry.define()
	const localName = (ElementClass as any).__localName;
	if (localName && typeof localName === "string") {
		return localName;
	}

	// Check the customElements registry (reverse lookup)
	if (
		typeof globalThis.customElements !== "undefined" &&
		typeof (globalThis.customElements as any).getName === "function"
	) {
		const registeredName = (globalThis.customElements as any).getName(ElementClass);
		if (registeredName) return registeredName;
	}

	// Convert PascalCase to kebab-case (unreliable with minified builds)
	const className = ElementClass.name;
	if (className && className.includes("-")) {
		// Only use class name if it already looks like a custom element name
		return className;
	}

	throw new Error("Could not determine tag name for Lit component");
}

function escapeAttributeValue(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

/**
 * Serialize props to HTML attributes
 */
export function serializeAttributes(props: Record<string, unknown>): string {
	const attributes: string[] = [];

	for (const [key, value] of Object.entries(props)) {
		if (value === undefined || value === null) continue;

		const attrName = key.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

		if (typeof value === "boolean") {
			if (value) attributes.push(attrName);
		} else if (typeof value === "string") {
			attributes.push(`${attrName}="${escapeAttributeValue(value)}"`);
		} else if (typeof value === "number") {
			attributes.push(`${attrName}="${value}"`);
		} else if (typeof value === "object") {
			try {
				attributes.push(`${attrName}='${escapeAttributeValue(JSON.stringify(value))}'`);
			} catch {
				/* skip */
			}
		}
	}

	return attributes.join(" ");
}

/**
 * Collect styles from Lit component
 */
export function collectStyles(ElementClass: typeof LitElement): string {
	try {
		const styles = (ElementClass as any).styles;
		if (!styles) return "";

		if (Array.isArray(styles)) {
			return styles.map(extractCssFromStyle).filter(Boolean).join("\n");
		}
		return extractCssFromStyle(styles);
	} catch {
		return "";
	}
}

function extractCssFromStyle(style: unknown): string {
	if (!style) return "";
	if (typeof style === "string") return style;
	if (typeof style === "object" && "cssText" in style) {
		return (style as CSSResult).cssText;
	}
	if (typeof style === "object" && "toString" in style) {
		return (style as { toString(): string }).toString();
	}
	return "";
}

/**
 * Extract tag name from source code (avoids decorator issues)
 */
export async function extractTagNameFromSource(src: string): Promise<string | null> {
	try {
		const resolvedSrc = await resolveIslandPath(src);
		const componentPath = resolvedSrc.startsWith("/")
			? join(process.cwd(), resolvedSrc.slice(1))
			: resolvedSrc;

		const content = await readFile(componentPath, "utf-8");

		// Try @customElement decorator with different quote styles
		const decoratorPatterns = [
			/@customElement\s*\(\s*"([^"]+)"\s*\)/,
			/@customElement\s*\(\s*'([^']+)'\s*\)/,
			/@customElement\s*\(\s*`([^`]+)`\s*\)/,
		];

		for (const pattern of decoratorPatterns) {
			const match = new RegExp(pattern).exec(content);
			if (match?.[1]) return match[1];
		}

		// Try static elementName property (for decorator-free components)
		const elementNamePatterns = [
			/static\s+elementName\s*=\s*"([^"]+)"/,
			/static\s+elementName\s*=\s*'([^']+)'/,
			/static\s+elementName\s*=\s*`([^`]+)`/,
		];

		for (const pattern of elementNamePatterns) {
			const match = new RegExp(pattern).exec(content);
			if (match?.[1]) return match[1];
		}

		// Try customElements.define() call
		const definePatterns = [
			/customElements\.define\s*\(\s*"([^"]+)"/,
			/customElements\.define\s*\(\s*'([^']+)'/,
			/customElements\.define\s*\(\s*`([^`]+)`/,
		];

		for (const pattern of definePatterns) {
			const match = new RegExp(pattern).exec(content);
			if (match?.[1]) return match[1];
		}

		// Try exported tagName constant
		const tagNamePatterns = [
			/export\s+const\s+tagName\s*=\s*"([^"]+)"/,
			/export\s+const\s+tagName\s*=\s*'([^']+)'/,
			/export\s+const\s+tagName\s*=\s*`([^`]+)`/,
		];

		for (const pattern of tagNamePatterns) {
			const match = new RegExp(pattern).exec(content);
			if (match?.[1]) return match[1];
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Load a Lit component from file path
 */
export async function loadComponent(
	src: string,
	viteServer?: { ssrLoadModule: (path: string) => Promise<Record<string, unknown>> },
): Promise<typeof LitElement> {
	const resolvedSrc = await resolveIslandPath(src);
	let module: Record<string, unknown>;

	if (viteServer) {
		module = await viteServer.ssrLoadModule(resolvedSrc);
	} else {
		const componentPath = resolvedSrc.startsWith("/")
			? join(process.cwd(), resolvedSrc.slice(1))
			: resolvedSrc;
		module = await import(/* @vite-ignore */ toImportSpecifier(componentPath));
	}

	const Component = module.default || module[Object.keys(module)[0]];

	if (!Component || typeof Component !== "function") {
		throw new Error(`Invalid Lit component in ${src}`);
	}

	return Component as typeof LitElement;
}
