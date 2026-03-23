/**
 * Built-in custom hydration directives.
 *
 * These extend the core set (on:client, on:visible, on:interaction, on:idle, media:*)
 * with additional strategies that users can opt into.
 *
 * Import and call `registerBuiltinDirectives()` in your server entry
 * to make them available.
 *
 * @module islands/builtin-directives
 */

import { registerHydrationDirective } from "./hydration-directives.ts";

/**
 * Register all built-in custom directives.
 */
export function registerBuiltinDirectives(): void {
	registerHydrationDirective("on:delay", {
		name: "on:delay",
		script: (_el, hydrate, arg) => {
			const ms = Number.parseInt(arg || "1000", 10);
			setTimeout(hydrate, ms);
		},
	});

	registerHydrationDirective("on:event", {
		name: "on:event",
		script: (_el, hydrate, arg) => {
			if (!arg) {
				hydrate();
				return;
			}
			const handler = () => {
				document.removeEventListener(arg, handler);
				hydrate();
			};
			document.addEventListener(arg, handler, { once: true });
		},
	});

	registerHydrationDirective("on:scroll", {
		name: "on:scroll",
		script: (_el, hydrate, arg) => {
			const threshold = Number.parseInt(arg || "100", 10);
			const handler = () => {
				if (globalThis.scrollY >= threshold) {
					globalThis.removeEventListener("scroll", handler);
					hydrate();
				}
			};
			globalThis.addEventListener("scroll", handler, { passive: true });
			// Check immediately in case already scrolled
			if (globalThis.scrollY >= threshold) {
				globalThis.removeEventListener("scroll", handler);
				hydrate();
			}
		},
	});

	registerHydrationDirective("on:match", {
		name: "on:match",
		script: (_el, hydrate, arg) => {
			if (!arg) {
				hydrate();
				return;
			}
			const mql = globalThis.matchMedia(arg);
			if (mql.matches) {
				hydrate();
				return;
			}
			const handler = (e: MediaQueryListEvent) => {
				if (e.matches) {
					mql.removeEventListener("change", handler);
					hydrate();
				}
			};
			mql.addEventListener("change", handler);
		},
	});
}
