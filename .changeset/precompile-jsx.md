---
"@useavalon/avalon": minor
"@useavalon/core": minor
"@useavalon/preact": minor
"@useavalon/seo": minor
"create-avalon": minor
---

Precompile static JSX in page and layout files into constant templates. Preact renders them without building a virtual DOM for the static markup, which makes server rendering of large pages much faster. Output is unchanged, and components, hooks, context and async components keep working. Turn it off with `precompileJsx: false` (or `AVALON_PRECOMPILE=0`).
