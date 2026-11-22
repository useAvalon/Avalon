/**
 * Shell render engine.
 *
 * The "shell" is the page/layout/island-wrapper tree that Avalon renders to
 * HTML on the server. By default this uses Preact (`preact-render-to-string`
 * + `preact`'s `h`/`Fragment`), but when a project sets `core: "react"` the
 * app's SSR bundle overrides these with `react-dom/server` +
 * `react`'s `createElement`/`Fragment` via the setters below.
 *
 * Keeping these as injected functions means the core `@useavalon/avalon`
 * package never has to depend on React — the React renderer is provided by the
 * app bundle (which has React installed) through the generated
 * `virtual:avalon/renderer` module.
 */

import { Fragment as preactFragment, h as preactH, type VNode } from "preact";
import preactRenderToString from "preact-render-to-string";
import { renderToReadableStream as preactRenderToReadableStream } from "preact-render-to-string/stream";

/** A function that renders a shell vnode/element to an HTML string. */
export type ShellRenderToString = (vnode: unknown) => string;

/**
 * A createElement/`h`-style factory. Preact's `h` and React's `createElement`
 * are call-compatible; the return is typed as Preact's `VNode` (the default
 * engine) so consumers like island.tsx type-check cleanly.
 */
export type ShellCreateElement = (type: unknown, props?: unknown, ...children: unknown[]) => VNode;

// Defaults: Preact. The core package already depends on preact + preact-render-to-string,
// so the default engine works with zero additional configuration.
let renderToStringImpl: ShellRenderToString = (vnode) => preactRenderToString(vnode as VNode);

// Streaming is only available for the default Preact engine; an overridden renderer
// (React) has no Suspense-aware stream wired in here.
let usesDefaultRenderer = true;

let createElementImpl: ShellCreateElement = preactH as unknown as ShellCreateElement;
let fragmentImpl: unknown = preactFragment;

/**
 * Override the shell renderer. Called once at SSR-bundle load time by the
 * generated renderer module when `core: "react"`.
 */
export function setShellRenderToString(fn: ShellRenderToString): void {
	renderToStringImpl = fn;
	usesDefaultRenderer = false;
}

/**
 * Override the shell element factory + fragment. Called once at SSR-bundle load
 * time by the generated renderer module when `core: "react"` so island/layout
 * wrappers are created as React elements.
 */
export function setShellElementFactory(createElement: ShellCreateElement, fragment: unknown): void {
	createElementImpl = createElement;
	fragmentImpl = fragment;
}

/** Render a shell vnode/element to an HTML string using the active engine. */
export function renderShell(vnode: unknown): string {
	return renderToStringImpl(vnode);
}

/**
 * Render a shell vnode to a byte stream that flushes the synchronous markup first and then
 * each `Suspense` boundary as it resolves. Returns `null` when the active engine is not the
 * default Preact one, so callers fall back to {@link renderShell}.
 */
export function renderShellToStream(
	vnode: unknown,
	onError?: (error: unknown) => void,
): (ReadableStream<Uint8Array> & { allReady: Promise<void> }) | null {
	if (!usesDefaultRenderer) return null;
	return preactRenderToReadableStream(vnode as VNode, { onError });
}

/** Create a shell element (delegates to the active engine's createElement/h). */
export const shellH: ShellCreateElement = (type, props, ...children) =>
	createElementImpl(type, props, ...children);

/** The active engine's Fragment. Access via getter so overrides are picked up. */
export function shellFragment(): unknown {
	return fragmentImpl;
}
