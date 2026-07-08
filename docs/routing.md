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
app.get('/users/:id/books/:bookid', (c) => {
	return { user: c.param('id'), book: c.param('bookid') };
});
```

Parameter names are lowercased internally: `c.param('ID')` and `c.param('id')` are equivalent.

## Handler return values

If the handler returns a value and the response has not been sent yet, Mousse responds automatically:

| Returned value | Response |
|---|---|
| `string` | Sent as-is |
| `object` | Serialized through `c.json()` |
| `undefined` / anything else | Empty response with current status |

You can always respond manually instead with `c.respond()`, `c.json()`, `c.html()`, `c.file()`.

## Middlewares

A middleware receives the same `Context` as the handler and may be async. Middlewares run in registration order, before the handler.

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
import { Router } from 'mousse';

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
	schemas: { Body, Query, Params, Response }  // Validation & typing, see docs/schemas.md
}, handler);
```

WebSocket routes additionally accept `maxBackPressure` and `wsErrorHandler`.

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
2. Otherwise the error is logged (route `logger` if any, `console.error` as fallback).
3. If the response was still not sent, Mousse responds with a `500`. Errors never end up as an implicit `200`.
