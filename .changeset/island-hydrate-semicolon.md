---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Fix the per-island inline hydration script. The hydrate call was missing a statement terminator, so the generated code read `await fn(e,C,p)e.dataset.hydrated="true"` and the browser rejected the whole script with a syntax error, leaving islands unhydrated.
