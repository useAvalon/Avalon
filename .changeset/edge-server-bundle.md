---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Keep build tooling out of the server bundle. Generated renderer, page and MDX code imports Avalon through runtime subpaths (`@useavalon/avalon/islands/island`, `@useavalon/avalon/islands/builtin-directives`) instead of the package barrel, which re-exports the Vite plugin. Edge builds (`cloudflare_module`, `cloudflare_pages`) no longer contain Vite, `nitro/vite`, rolldown or `@vercel/nft`, or the unused framework integrations, and render on workerd.
