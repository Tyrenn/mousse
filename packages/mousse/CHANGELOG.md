# @tyren/mousse

## 1.1.0

### Minor Changes

- 8b7df76: Production safety:

  - `bodyLimit` route / router option (bytes, 1 MiB by default). A declared `content-length` above it is answered `413` before middlewares run; a body growing past it while received (chunked, lying `content-length`) makes `c.body()` throw a `PayloadTooLargeError` (`413`). Extra chunks are dropped, never buffered.
  - `trustProxy` Mousse option (IPs, CIDR ranges, `loopback` / `private` / `linklocal` aliases, `true` or a predicate) and new `c.ip`, `c.ips`, `c.protocol`, `c.host`. `x-forwarded-for` is walked from the right, stopping at the first untrusted hop. `WSContext.ip` exposes the address resolved at upgrade.
  - `HTTPError(statusCode, message)`: thrown from a middleware or handler, answered with its status and `{ error: message }` when no `httpErrorHandler` is set.

- 8b7df76: **Breaking (security fix)**: a middleware that answers now ends the request. The next middlewares and the route handler used to run anyway, so `c.status(401).respond()` in an auth middleware blocked the response but not the handler's side effects. Same on websocket upgrades for the next middlewares. Applications relying on code running after a middleware answered must move it to an `onResponse` hook.
- 8b7df76: `router.onResponse([pattern,] (c, {statusCode, elapsedTime, aborted}) => ...)` hook, called once per request when the response has ended: sent, aborted by the client, upgraded to a websocket or SSE stream closed. Scoped by pattern like middlewares and carried by mounted routers. Meant for access logs and metrics; hook errors are logged, never propagated.
- 2d5bc58: Production fixes on Context:

  - **Breaking**: route param names keep their declared case. `/offers/:idOffer` is now read with `c.param('idOffer')` (was `idoffer`), matching `Params` schemas and inferred types.
  - Multi-valued response headers: `c.header(name, string[])` and new `c.appendHeader(name, value)` write one header line per value, so several `set-cookie` can be sent.
  - `c.file()` streams the file with backpressure instead of loading it in memory, answers `404` only for missing files / non regular files and `500` for other errors.
  - `del` handlers can read `c.body()` (the body was already consumed, only the type forbade it).

- 8b7df76: Rate limiting and request hooks, both running before anything of the request is analysed (schemas, body limit, middlewares):

  - New `rateLimiter` route and router option, also `setDefaultRateLimiter()`. It takes any `RateLimiter` implementation, `false` disables an inherited one. `DefaultRateLimiter` is provided, modeled on `@fastify/rate-limit`, with in memory and Redis stores.
  - New `router.onRequest(pattern?, hook)` method and `onRequest` route option.

- 8b7df76: Server-Sent Events:

  - `c.onAbort(listener)` and `c.aborted`: release timers and subscriptions when the client disconnects (any context, SSE first).
  - `c.send(data, {event, id, retry})`: multi-line data is split into several `data:` lines as the spec requires; `event` / `id` line breaks are stripped.
  - `c.ping()` comment frame and `heartbeat` option (`app.sse(pattern, {heartbeat : 15000}, ...)` or `c.sustain({heartbeat})`).
  - `c.respond()` on a sustained context ends the stream.
  - Fix: `sustain()` now sends the headers set by middlewares (CORS...), plus `x-accel-buffering: no`.

- 8b7df76: Validation and responses:

  - **Breaking**: a route `Body` schema is validated after the middlewares and before the handler, even when the handler never reads the body (was: at the first `c.body()` call only, so unread invalid bodies passed).
  - **Breaking**: a single `Response` schema now only applies to 2xx responses. `c.status(404).json({error})` is no longer validated (and rejected with a 500) against the success schema.
  - `Response` accepts a map of schemas per status code or range (`{200 : Offer, '4xx' : ApiError}`), exact codes winning over ranges. Handler returns are typed from 2xx schemas, `c.json()` also accepts the other shapes. OpenAPI and HTML docs list every status.
  - Malformed bodies (invalid json...) are answered `400 {error : 'Malformed body'}` (`BodyParseError`) instead of `500`.
  - `validationErrorStatus` route / router option (400 by default) for invalid body, query and params.
  - Optional `ResponseSerializer.compile(schema)`, called once per response schema at route registration, replaces `serialize()` for matching responses (fast-json-stringify style).
  - Handlers may return the context (`return c.status(404).json(...)`) without type errors.

### Patch Changes

- d353875: **Security fix**: `c.file()` sent the lowercased absolute file path as `content-type` when the path contained a `/` (any Linux or macOS path), exposing the server file system layout and breaking the real content type. It is now resolved from the file name only.
- 8b7df76: highlight.js is only loaded when `generateHTMLDoc()` runs: a server importing mousse no longer loads it. Fixed the docgen example serving files outside its output directory. Documented supported platforms (µWebSockets.js v20.67.0: Node.js 22 / 24 / 26 on glibc Linux, macOS, Windows; no Alpine/musl).
- 8b7df76: An `HTTPError` thrown by a middleware of a `ws` route now rejects the upgrade with its status and `{error : message}`, like on an HTTP route. It used to answer 500 and log the error, unless the route had an `httpErrorHandler`.

## 1.0.0

### Major Changes

- First version

## 0.1.0

### Minor Changes

- ff4b599: Documentation generation redesign and robustness fixes.

  - `document()` becomes `generateDoc(docgen)`, with new `generateHTMLDoc(options)` and `generateOpenAPIDoc(options)` helpers on every Router
  - `SchemaParser` classes replaced by the `DocSchemaTranslator` function type, registered per Standard Schema vendor with `addDocSchemaTranslator(vendor, translate)`; registries merge by union when mounting routers
  - Doc generation is now strict by default : a schema vendor without translator throws (opt out with `lenient: true`)
  - `DefaultBodyParser` now matches content types carrying parameters (`application/json; charset=utf-8`)
  - Routes mounted at a router root (`GET /users` for a `/` route mounted on `/users`) now match correctly
  - `c.param()` returns `string` instead of `string | undefined` when the param is declared through schemas or generics
  - Middlewares and HTTP error handlers can return the context (`return c.status(401).respond()`)
