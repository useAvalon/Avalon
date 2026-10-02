import type { Plugin } from "vite";

let consoleWarnPatched = false;

/**
 * Suppresses known third-party dev noise that does not affect www behavior.
 */
export function quietDevWarningsPlugin(): Plugin {
	return {
		name: "www:quiet-dev-warnings",
		apply: "serve",
		config() {
			if (consoleWarnPatched) return;
			consoleWarnPatched = true;
			const original = console.warn;
			console.warn = (...args: unknown[]) => {
				const msg = args[0];
				if (
					typeof msg === "string" &&
					msg.includes("PostCSS plugin did not pass the `from` option")
				) {
					return;
				}
				original.apply(console, args as Parameters<typeof console.warn>);
			};
		},
	};
}
