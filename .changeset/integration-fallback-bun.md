---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Fall back to the monorepo copy of an integration when Bun reports an unresolved import. Bun throws a `ResolveMessage`, which is not an `Error` instance, so the not-found check returned false and `@useavalon/preact` could not be loaded from `packages/integrations`.
