---
"@tyren/mousse": minor
---

`router.onResponse([pattern,] (c, {statusCode, elapsedTime, aborted}) => ...)` hook, called once per request when the response has ended: sent, aborted by the client, upgraded to a websocket or SSE stream closed. Scoped by pattern like middlewares and carried by mounted routers. Meant for access logs and metrics; hook errors are logged, never propagated.
