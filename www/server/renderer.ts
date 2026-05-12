/**
 * SSR Renderer — provided by Avalon's virtual module system.
 *
 * Avalon auto-discovers layouts, injects client assets, and handles
 * layout wrapping. Import from the virtual modules directly to customize:
 *
 *   import { wrapWithLayouts } from 'virtual:avalon/layouts';
 *   import { injectAssets } from 'virtual:avalon/assets';
 */

import { registerHydrationDirective } from "@useavalon/avalon";

// Register a custom hydration directive that delays hydration by N seconds.
// The countdown is visible in the island's DOM before hydration fires.
registerHydrationDirective("on:countdown", {
	name: "on:countdown",
	script: (el, hydrate, arg) => {
		const parsed = parseInt(arg || "5", 10);
		const seconds = Number.isNaN(parsed) || parsed <= 0 ? 5 : parsed;
		const badge = el.querySelector("[data-countdown]") as HTMLElement | null;
		let remaining = seconds;

		const tick = setInterval(() => {
			remaining--;
			if (badge) badge.textContent = `Hydrates in ${remaining}s...`;
			if (remaining <= 0) {
				clearInterval(tick);
				if (badge) {
					badge.style.transition = "opacity 0.3s";
					badge.style.opacity = "0";
					setTimeout(() => badge.remove(), 300);
				}
				hydrate();
			}
		}, 1000);
	},
});

export { default } from "virtual:avalon/renderer";
