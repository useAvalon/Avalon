---
"@useavalon/avalon": minor
"@useavalon/core": minor
"@useavalon/preact": minor
"@useavalon/seo": minor
"create-avalon": minor
---

Stream pages that use layouts. When a page has a pending `Suspense` boundary, the layout head and page shell are flushed first and each boundary follows as it resolves, using Preact's `renderToReadableStream`. Pages with nothing pending, development, the client router, HTML post-process hooks, `core: "react"` and `streaming: false` keep the buffered response with identical output. Streamed responses send `X-Accel-Buffering: no`.
