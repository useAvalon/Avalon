// Avalon — Slim hydration runtime for production builds
// Shared entry-client path (clientRouter / HMR-less prod). Re-entrant via scanAndHydrate.

import { scanAndHydrate } from "./hydrate-runtime.ts";
import { bootServerIslands } from "./server-islands-boot.ts";

function initializeHydration() {
	scanAndHydrate();
	bootServerIslands();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeHydration);
} else {
	initializeHydration();
}
