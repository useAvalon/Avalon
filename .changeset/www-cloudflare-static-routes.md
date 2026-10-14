---
"@useavalon/avalon": patch
---

Exclude root font and syntax CSS from Cloudflare Pages Functions so static `_headers` CSP applies without duplicate Worker policies. Default Nitro `routeRules` disable cache on `/_server-islands/**` and `/_actions/**`.
