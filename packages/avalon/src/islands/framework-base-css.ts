/**
 * Framework Baseline CSS
 *
 * Provides default styling for Avalon's framework-emitted custom elements
 * (`<avalon-island>`, `<avalon-page>`, `<avalon-page-content>`, `<avalon-server-island>`).
 *
 * These elements are used as DOM anchors for hydration and content
 * placement. They must be transparent to layout — otherwise an island
 * placed inside a flex/grid container would force the children into a
 * separate inline-level box, breaking the layout.
 *
 * The rule is `display: contents`, which makes the element invisible to
 * the layout engine while keeping it queryable from JS and visible in
 * devtools. This mirrors the pattern Astro, Lit, and Elder.js use for
 * island-style hydration anchors.
 *
 * Client-only islands have no SSR children, so `display: contents` would
 * leave a host with no box. Those use `display: block` so deferred
 * conditions (`on:visible`, `on:interaction`) can attach to the host.
 *
 * The CSS is intentionally low-specificity (single-element selectors)
 * so any user CSS that sets a different `display` value naturally wins.
 */

const FRAMEWORK_BASE_CSS =
	"avalon-island,avalon-page,avalon-page-content,avalon-server-island,[data-server-island-wrapper]{display:contents}avalon-island[data-render-strategy=client-only]{display:block}";

const STYLE_TAG = `<style data-avalon-base="true">${FRAMEWORK_BASE_CSS}</style>`;

const STYLE_TAG_MARKER = 'data-avalon-base="true"';

/**
 * Inject the framework baseline `<style>` tag into the document head.
 *
 * Idempotent — if the marker is already present (e.g. the layout already
 * rendered the tag, or this function is called twice), the HTML is
 * returned unchanged.
 *
 * The tag is inserted as the first child of `<head>` so subsequent
 * stylesheets and inline styles can override it via the cascade.
 *
 * @param html - The rendered HTML string
 * @returns HTML with the baseline `<style>` tag injected, or unchanged
 *   if no `<head>` is present or the tag is already there.
 */
export function injectFrameworkBaseCSS(html: string): string {
	if (html.includes(STYLE_TAG_MARKER)) return html;
	if (!html.includes("<head>") && !html.includes("<head ")) return html;

	// Insert immediately after the opening <head> tag so user styles
	// (which appear later in <head>) win in the cascade.
	return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${STYLE_TAG}`);
}

/** Exposed for tests */
export const __FRAMEWORK_BASE_CSS = FRAMEWORK_BASE_CSS;
