---
"@useavalon/avalon": patch
---

Fix builds under pnpm's strict `node_modules` layout: the generated server entry imported `urlpattern-polyfill` from the app, which does not declare it. It now loads the polyfill through the new `@useavalon/avalon/polyfills/urlpattern` subpath, so a fresh `create-avalon` project builds with pnpm without adding the dependency by hand.
