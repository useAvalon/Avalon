/**
 * Nitro SSR catch-all. Keep the default re-export unless you need a custom
 * hydration directive or a wrapper around renderer.fetch.
 * See https://useavalon.dev/docs/ssr-renderer
 */

import { registerHydrationDirective } from "@useavalon/avalon";
import { runCountdownDirective } from "../app/shared/hydration/countdown.ts";

registerHydrationDirective("on:countdown", {
	name: "on:countdown",
	script: runCountdownDirective,
});

export { default } from "virtual:avalon/renderer";
