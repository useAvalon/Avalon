/**
 * Client entry point — hydrates islands rendered by the SSR entry.
 *
 * Avalon auto-discovers layout CSS and includes the hydration runtime.
 * Global CSS is configured via `nitro.globalCSS` in vite.config.ts.
 *
 * Register custom directives before the shared runtime so `scanAndHydrate`
 * finds them. Side-effect import order is the registration.
 */
import "./shared/hydration/register-countdown.ts";
import "virtual:avalon/client-entry";
