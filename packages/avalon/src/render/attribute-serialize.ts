/**
 * Attribute serialization that matches Preact's string renderer.
 *
 * Shared by the precompile transform (static attributes, evaluated at build time) and the runtime
 * helper (dynamic attributes), so a template always writes the same bytes as the element it replaced.
 */

import { jsxEscape } from "preact/jsx-runtime";

/** Enumerated attributes that Preact's renderer writes as strings (`draggable="true"`). */
const ENUMERATED_ATTRIBUTES = new Set(["draggable", "spellcheck"]);

/** The renderer's own test for a signal: an object with a callable `peek` and a `value`. */
export function isSignal(value: unknown): value is { value: unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { peek?: unknown }).peek === "function" &&
		"value" in value
	);
}

/** Signals expose their current value as `.value`; the renderer reads it. */
function unwrapSignal(value: unknown): unknown {
	return isSignal(value) ? value.value : value;
}

/**
 * Serializes one attribute exactly like Preact's string renderer does for an element prop, with the
 * leading space, or returns an empty string when the prop produces no attribute. Names must already
 * be plain lowercase HTML names (the transform keeps everything else on Preact's own path).
 */
export function serializeAttribute(name: string, value: unknown): string {
	let v = unwrapSignal(value);
	if (typeof v === "function") return "";
	// aria-* and data-* (name[4] === "-") and enumerated attributes serialize booleans as text.
	if ((name[4] === "-" || ENUMERATED_ATTRIBUTES.has(name)) && v != null) v = `${v}`;
	if (v == null || v === false) return "";
	if (v === true || v === "") return ` ${name}`;
	const escaped = jsxEscape(String(v));
	return ` ${name}="${escaped}"`;
}
