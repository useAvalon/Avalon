/**
 * Runtime helpers for precompiled JSX.
 *
 * The precompile transform turns static markup into constant string arrays and calls these
 * helpers for the dynamic parts. Preact's string renderer understands `jsxTemplate` vnodes, so
 * components, hooks and context keep working around them; only the static HTML is skipped over.
 */

import { Fragment, jsx, jsxEscape, jsxTemplate } from "preact/jsx-runtime";
import renderToString from "preact-render-to-string";
import { isSignal, serializeAttribute } from "./attribute-serialize.ts";

export { jsxEscape, jsxTemplate };

/**
 * Called by compiled templates for a dynamic child. Arrays go to the renderer untouched, which
 * escapes their strings once and never modifies the caller's array; signals are wrapped in a vnode so
 * they render as they would anywhere else; everything else is escaped here.
 */
export function child(value: unknown): unknown {
	if (Array.isArray(value)) return value;
	// A signal is wrapped in a vnode so the renderer treats it exactly as it would as a normal child.
	if (isSignal(value)) return jsx(Fragment, { children: value });
	return jsxEscape(value);
}

/** Evaluates a dropped `key` or `ref` expression for its side effects and renders nothing. */
export function discard(_value: unknown): string {
	return "";
}

/** Called by compiled templates for dynamic attribute values. */
export function attr(name: string, value: unknown): string {
	return serializeAttribute(name, value);
}

// Precompiled templates are recognised by identity: the renderer compares its own `Fragment` with
// the vnode's. A project with two copies of Preact installed would render every template as an
// empty string, so fail at startup with a clear message instead.
if (renderToString(jsxTemplate(["<i></i>"])) !== "<i></i>") {
	throw new Error(
		"Avalon: precompiled JSX templates render empty because more than one copy of `preact` is installed. " +
			"Install a single version (for example `bun pm ls preact` / `npm ls preact`) or set " +
			"`precompileJsx: false` in the Avalon config.",
	);
}
