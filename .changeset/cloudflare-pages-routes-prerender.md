---
"@useavalon/avalon": patch
---

Fix Cloudflare Pages previews: apply static-first `_routes.json` only when prerender writes `index.html`, and stub Rolldown native bindings in Nitro’s worker bundle so SSR no longer 500s with missing `@rolldown/binding-*`.
