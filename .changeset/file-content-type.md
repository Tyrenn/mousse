---
"@tyren/mousse": patch
---

**Security fix**: `c.file()` sent the lowercased absolute file path as `content-type` when the path contained a `/` (any Linux or macOS path), exposing the server file system layout and breaking the real content type. It is now resolved from the file name only.
