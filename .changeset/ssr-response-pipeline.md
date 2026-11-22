---
"@useavalon/avalon": patch
"@useavalon/core": patch
"@useavalon/preact": patch
"@useavalon/seo": patch
"create-avalon": patch
---

Render responses without repeatedly copying the page HTML. Layout and asset injection run on the small layout markup around the page, the page is encoded once, and the head passes only scan the head. Islands emit their hydration script as a real `<script>` element, and pages with no client code no longer load an empty entry script.
