---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Restore buffered throughput for layout pages without `Suspense`. The page is rendered on the synchronous renderer first, exactly as the buffered path does, and only restarts on Preact's stream renderer when a `Suspense` boundary is actually pending. Output is unchanged.
