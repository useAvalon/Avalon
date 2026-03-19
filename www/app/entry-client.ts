/**
 * Client entry point — hydrates islands rendered by the SSR entry.
 *
 * Nitro's Vite plugin builds this as the "client" environment entry.
 * The SSR entry imports its asset manifest via `?assets=client` to
 * inject the correct <script>/<link> tags into the HTML.
 */

// Avalon's island hydration runtime — discovers [data-framework]
// elements and lazily hydrates them based on their condition
// (on:client, on:visible, on:interaction, on:idle, media:…).
import '@useavalon/avalon/src/client/main.js';
