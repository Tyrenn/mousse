[« Documentation index](../README.md#documentation)

# Routing

## Registering routes

Each HTTP verb has a helper method. All of them share the same signature:

```ts
app.METHOD(pattern, [options,] ...middlewares, handler);
```

Available helpers: `get`, `post`, `put`, `patch`, `del`, `head`, `options`, `any` (matches every verb), plus `ws` ([WebSockets](websockets.md)) and `sse` ([Server-Sent Events](server-sent-events.md)). The generic form `add(method, pattern, ...)` is also available.

Routes can carry [schemas](schemas.md) validating and typing their body, query, params and response.

```ts
app.get('/users', (c) => {
	return [{ id: 1 }];
});

app.post('/users', { logger: myLogger }, authMiddleware, async (c) => {
	const body = await c.body();
	return { created: true };
});
```

The last function is always the **handler**; every function before it is a **middleware** scoped to that route only. See [Handler return values](#handler-return-values).

## Patterns and parameters

Patterns follow the µWebSockets.js syntax:

- `/static/path` — exact match
- `/users/:id` — named parameter, read with `c.param('id')` or `c.params`
- `/files/*` — wildcard

```ts
app.get('/users/:id/books/:bookId', (c) => {
	return { user: c.param('id'), book: c.param('bookId') };
});
```

Parameter names keep the case they are declared with: `:bookId` is read with `c.param('bookId')`, and a `Params` schema must use the same key.

## Handler return values

If the handler returns a value and the response has not been sent yet, Mousse responds automatically:

| Returned value | Response |
|---|---|
| `string` | Sent as-is |
| `object` | Serialized through `c.json()` |
| `undefined` / anything else | Empty response with current status |

You can always respond manually instead with `c.respond()`, `c.json()`, `c.html()`, `c.file()`.

## Middlewares

A middleware receives the same `Context` as the handler and may be async. Middlewares run in registration order, before the handler. A middleware that answers (`c.respond()`, `c.json()`...) ends the request : the next middlewares and the handler do not run.

Global middlewares are registered with `use`:

```ts
app.use((c) => {
	c.log('request incoming');
});

// Scoped to a pattern prefix
app.use('/admin', authMiddleware);
```

A pattern scoped middleware matches on **segment boundaries**: `/user` applies to `/user` and `/user/me`, but not to `/users`.

Middlewares must be registered **before** `listen()` is called; routes are bound to their matching middlewares at registration time.

## Routers

A `Router` is a collection of routes and middlewares that can be mounted on an app (or another router) with `use`:

```ts
import { Router } from '@tyren/mousse';

const users = new Router();
users.get('/', (c) => 'user list');
users.get('/:id', (c) => ({ id: c.param('id') }));

app.use('/users', users);
// GET /users        -> 'user list'
// GET /users/:id    -> { id }
```

Mounting **copies** routes and middlewares into the target, prefixing their patterns. A router definition can therefore be reused and mounted several times at different paths.

Routers accept default options applied to every route they contain (see [Modules](modules.md)):

```ts
const router = new Router({
	logger: myLogger,
	httpErrorHandler: myErrorHandler
});
```

Options explicitly set on a route always win over router defaults.

## Route options

Every route accepts an options object right after the pattern:

```ts
app.post('/items', {
	bodyParser: myBodyParser,             // How the request body is parsed
	responseSerializer: mySerializer,     // How c.json() payloads are serialized
	httpErrorHandler: myErrorHandler,     // Called when a middleware/handler throws
	logger: myLogger,                     // Available as c.log()
	bodyLimit: 10 * 1024 * 1024,          // Max request body in bytes, 1 MiB by default
	validationErrorStatus: 422,           // Invalid request data status, 400 by default
	rateLimiter: myRateLimiter,           // See docs/rate-limiting.md, false disables an inherited one
	onRequest: myHook,                    // One or several hooks, see below
	schemas: { Body, Query, Params, Response }  // Validation & typing, see docs/schemas.md
}, handler);
```

WebSocket routes additionally accept `maxBackPressure` and `wsErrorHandler`.

## Request hooks

`onRequest` runs **before anything of the request is analysed**, unlike a middleware. A request goes through:

1. Request hooks : the router ones, then the route ones
2. [Rate limiter](rate-limiting.md)
3. Body limit
4. `Params` and `Query` [schemas](schemas.md)
5. Middlewares
6. `Body` schema
7. Handler

It is the place for what must reach invalid requests too, or spare them any work : blocking an address, tagging a request, counting it.

```ts
app.onRequest((c) => {
	if (blocklist.has(c.ip))
		return c.status(403).respond();
});

app.onRequest('/admin', adminHook);                 // scoped like middlewares

app.get('/report', { onRequest: reportHook }, handler);       // this route only
app.get('/export', { onRequest: [first, second] }, handler);
```

Hooks registered on a router follow it when mounted with `use`. They add up, and a route's hooks run after those of its router. Answering or throwing ends the request, like in a middleware.

Nothing is validated yet : `c.param()` and `c.query` are raw strings whatever the schemas declare, so hooks are not typed by them. Use a middleware when you need validated values. On a `ws` route, hooks run on the upgrade request.

## Response hooks

`onResponse` runs once each response has ended — sent, aborted by the client, upgraded to a WebSocket (`101`), or SSE stream closed. It is the place for access logs and metrics:

```ts
app.onResponse((c, { statusCode, elapsedTime, aborted }) => {
	httpDuration.labels(c.method(), c.route, String(statusCode)).observe(elapsedTime / 1000);
});

app.onResponse('/admin', (c, info) => audit(c.url, info));   // scoped like middlewares
```

`c.route` is the matched pattern (`/users/:id`), keeping metric cardinality bounded. `elapsedTime` is in milliseconds, measured from the moment the request reached Mousse. Hooks run after the response and cannot change it; their errors (sync or async) are logged, never propagated. Like middlewares, hooks registered on a router follow it when mounted with `use`.

## Default handler (404)

The default handler catches any request that matched no route. Set it on the app or through router options:

```ts
app.setDefaultHandler({
	handle: (c) => c.status(404).respond('Nothing here')
});
```

## Error handling

When a middleware or handler throws:

1. The route's `httpErrorHandler` is called if defined — it may respond itself.
2. Otherwise an `HTTPError` (or subclass such as `PayloadTooLargeError`, `BodyParseError`) is answered with its `statusCode` and `{ error: message }`, a [schema validation error](schemas.md) with `400` (`validationErrorStatus`), and anything else is logged (route `logger` if any, `console.error` as fallback).
3. If the response was still not sent, Mousse responds with a `500`. Errors never end up as an implicit `200`.

```ts
import { HTTPError } from '@tyren/mousse';

app.get('/offers/:idOffer', async (c) => {
	const offer = await findOffer(c.param('idOffer'));
	if(!offer)
		throw new HTTPError(404, 'Offer not found');   // -> 404 { error: 'Offer not found' }
	return offer;
});
```

---

| [« Getting started](getting-started.md) | [Documentation index](../README.md#documentation) | [Context »](context.md) |
|:---|:---:|---:|
