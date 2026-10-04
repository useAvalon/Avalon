---
"@useavalon/avalon": patch
---

Apply Cloudflare Pages `_routes.json` static-first routing only after prerender writes `index.html`, so failed prerender no longer 404s HTML routes.
