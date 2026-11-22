---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Serve the copied SSR stylesheet in production. The post-build step only recognised the old compact Nitro asset manifest, so with the current pretty-printed format `ssr-index-*.css` was copied to disk but never registered, and the page linked a stylesheet that returned 404. Both formats are handled, including the `.br` and `.gz` variants.
