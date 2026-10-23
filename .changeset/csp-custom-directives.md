---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
"@useavalon/mcp": patch
---

Run custom hydration directives as a parsed module instead of `new Function`. The inline bootstrap still needs `'unsafe-inline'`, a nonce, or a script hash; `'self'` alone is not enough.
