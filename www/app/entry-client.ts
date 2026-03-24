/**
 * Client entry point — hydrates islands rendered by the SSR entry.
 *
 * Avalon auto-discovers layout CSS and includes the hydration runtime.
 * Global CSS is configured via `nitro.globalCSS` in vite.config.ts.
 */
import "virtual:avalon/client-entry";
