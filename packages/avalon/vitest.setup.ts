/**
 * Vitest setup for @useavalon/avalon.
 *
 * `URLPattern` is a runtime global in Node 22+/Bun/Deno, but it is not present
 * in every CI runner. Several modules (layout discovery, middleware discovery,
 * routing) construct `new URLPattern(...)` at runtime, so we polyfill it when
 * the global is missing to keep tests deterministic across runtimes.
 */
import { URLPattern as URLPatternPolyfill } from "urlpattern-polyfill";

if (typeof (globalThis as { URLPattern?: unknown }).URLPattern === "undefined") {
	(globalThis as { URLPattern?: unknown }).URLPattern = URLPatternPolyfill;
}
