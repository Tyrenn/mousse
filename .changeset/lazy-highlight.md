---
"@tyren/mousse": patch
---

highlight.js is only loaded when `generateHTMLDoc()` runs: a server importing mousse no longer loads it. Fixed the docgen example serving files outside its output directory. Documented supported platforms (µWebSockets.js v20.67.0: Node.js 22 / 24 / 26 on glibc Linux, macOS, Windows; no Alpine/musl).
