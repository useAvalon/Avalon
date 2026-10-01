/// <reference types="bun" />

/**
 * Hoist inline `<style>` tags from `<body>` into `<head>`.
 *
 * Component-scoped CSS (Solid, Preact, etc.) often renders as inline styles in
 * the body. Post-build moves them into the head for faster first paint. Tags
 * use `data-avalon-ssr-css` so client navigation can reconcile them in
 * {@link reconcileHead} (see router swap.ts).
 *
 * Styles inside `<template>` (declarative shadow DOM) are left in place.
 */
export function hoistBodyStylesToHead(html: string): string {
	if (typeof HTMLRewriter === "undefined") {
		return html;
	}
	const seen = new Set<string>();
	const hoisted: string[] = [];
	let templateDepth = 0;
	let current: { attrs: string; css: string } | null = null;

	const stripped = new HTMLRewriter()
		.on("body template", {
			element(el) {
				templateDepth++;
				el.onEndTag(() => {
					templateDepth--;
				});
			},
		})
		.on("body style", {
			element(el) {
				if (templateDepth > 0) return;
				let attrs = "";
				for (const [name, value] of el.attributes) {
					if (name === "data-avalon-ssr-css") continue;
					attrs += ` ${name}="${value.replaceAll('"', "&quot;")}"`;
				}
				current = { attrs, css: "" };
				el.remove();
			},
			text(chunk) {
				if (!current) return;
				current.css += chunk.text;
				if (!chunk.lastInTextNode) return;

				const css = current.css.trim();
				const key = `${current.attrs}\0${css}`;
				if (css && !seen.has(key)) {
					seen.add(key);
					hoisted.push(`<style data-avalon-ssr-css="true"${current.attrs}>${css}</style>`);
				}
				current = null;
			},
		})
		.transform(html);

	if (hoisted.length === 0) return html;

	return new HTMLRewriter()
		.on("head", {
			element(el) {
				el.append(hoisted.join("\n"), { html: true });
			},
		})
		.transform(stripped);
}
