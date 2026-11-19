---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

The Cloudflare post-build patch rewrites `createRequire(import.meta.url)` only in real calls. Text inside strings, template literals, comments and regexes is left alone, so it can no longer break a Worker with a SyntaxError.
