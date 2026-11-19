---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Prerender runs `cloudflare_module` output (`.output/server/index.mjs` with a `cloudflare-module` `nitro.json`) behind the Worker wrapper, so Workers builds get static-first HTML. Prerender stops as soon as the server process exits instead of waiting 15s. Preset names accept both spellings (`cloudflare-module` and `cloudflare_module`).
