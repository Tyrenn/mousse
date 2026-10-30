---
"@tyren/mousse": minor
---

**Breaking (security fix)**: a middleware that answers now ends the request. The next middlewares and the route handler used to run anyway, so `c.status(401).respond()` in an auth middleware blocked the response but not the handler's side effects. Same on websocket upgrades for the next middlewares. Applications relying on code running after a middleware answered must move it to an `onResponse` hook.
