---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Integration load errors keep the original import error as `cause` and repeat its message. "Is it installed?" is suggested only when `@useavalon/<name>` itself cannot be found.
