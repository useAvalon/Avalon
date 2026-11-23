---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Support the `server` prop in MDX files. A component with `server={{ ... }}` in an `.mdx` page was rendered inline at build time, so its output was frozen into the static HTML. It is now rendered as a server island, optionally combined with an `island` prop.
