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
import '@useavalon/avalon/client/main';

// Global CSS — imported here so Vite includes it in the client
// assets manifest, which the SSR entry reads via ?assets=client
// to inject <link rel="stylesheet"> tags into the HTML.
import '@shared/styles/main.css';

// Layout CSS modules — the SSR entry renders layouts with hashed
// class names from these modules. We must import them here too so
// the CSS rules are included in the client bundle. Importing the
// default export (class map) forces Vite to process and emit the CSS.
import _rootLayout from '@shared/layouts/_layout.module.css';
import _navStyles from '@shared/styles/nav.module.css';
import _homeLayout from '@modules/home/layouts/home-layout.module.css';
import _docsLayout from '@modules/docs/layouts/_layout.module.css';
import _blogLayout from '@modules/blog/layouts/_layout.module.css';
// Prevent tree-shaking by referencing the imports
void [_rootLayout, _navStyles, _homeLayout, _docsLayout, _blogLayout];
