---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

The scaffolded `build.mjs` detects finished `cloudflare_pages` (`dist/nitro.json` + `dist/_worker.js`) and `cloudflare_module` (`.output/server/index.mjs` + `nitro.json`) output, so Cloudflare builds finish without waiting for the 240s timeout.
