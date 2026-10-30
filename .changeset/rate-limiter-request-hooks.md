---
"@tyren/mousse": minor
---

Rate limiting and request hooks, both running before anything of the request is analysed (schemas, body limit, middlewares):

- New `rateLimiter` route and router option, also `setDefaultRateLimiter()`. It takes any `RateLimiter` implementation, `false` disables an inherited one. `DefaultRateLimiter` is provided, modeled on `@fastify/rate-limit`, with in memory and Redis stores.
- New `router.onRequest(pattern?, hook)` method and `onRequest` route option.
