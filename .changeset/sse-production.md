---
"@tyren/mousse": minor
---

Server-Sent Events:

- `c.onAbort(listener)` and `c.aborted`: release timers and subscriptions when the client disconnects (any context, SSE first).
- `c.send(data, {event, id, retry})`: multi-line data is split into several `data:` lines as the spec requires; `event` / `id` line breaks are stripped.
- `c.ping()` comment frame and `heartbeat` option (`app.sse(pattern, {heartbeat : 15000}, ...)` or `c.sustain({heartbeat})`).
- `c.respond()` on a sustained context ends the stream.
- Fix: `sustain()` now sends the headers set by middlewares (CORS...), plus `x-accel-buffering: no`.
