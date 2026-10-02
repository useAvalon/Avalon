/**
 * URLPattern is a runtime global in Node 22+/Bun/Deno. Node 20 (still
 * common on CI and hosts) does not define it. Layout and middleware
 * matching construct `new URLPattern(...)` during SSR, so the published
 * server must polyfill before those modules run.
 */
import { URLPattern as URLPatternPolyfill } from "urlpattern-polyfill";

export function ensureURLPattern(): void {
	const globals = globalThis as unknown as { URLPattern?: typeof URLPatternPolyfill };
	globals.URLPattern ??= URLPatternPolyfill;
}

ensureURLPattern();
