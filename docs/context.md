# Context

Every request is wrapped in a `Context` object (`c` in the examples) passed to each middleware and handler. It exposes the request, the response and utility methods for HTTP, SSE and WebSocket upgrades.

µWebSockets.js invalidates its native request object as soon as a handler awaits. Mousse snapshots everything at construction, so all the accessors below stay safe to use **after any `await`**.

## Request

| Member | Description |
|---|---|
| `c.method()` | Actual HTTP method of the request (`'get'`, `'post'`...) |
| `c.url` | Request URL path |
| `c.route` | Pattern of the matched route (e.g. `/users/:id`) |
| `c.headers` | All request headers, lowercased keys |
| `c.getHeader(name)` | Single header value, `null` when absent |
| `c.contentType()` | Shortcut for the `content-type` header |
| `c.params` | Route parameters record |
| `c.param(name)` | Single route parameter |
| `c.query` | Parsed query string |
| `c.body()` | Parsed request body (see below) |
| `c.body(true)` | Raw body as a `Buffer`, `null` when the method carries no body |
| `c.request` | The underlying µWS request — only valid before the first `await` |

### Body

`c.body()` is async and cached: reading it twice returns the same value. Mousse starts consuming the body stream as soon as the request arrives, so it is safe to read it late, after other async work:

```ts
app.post('/items', async (c) => {
	await someAsyncCheck();
	const body = await c.body();   // still complete
});
```

Parsing is delegated to the route's [BodyParser](modules.md#bodyparser). The default one understands `application/json`, `application/x-www-form-urlencoded` and `multipart/form-data`, and falls back to the raw `Buffer` for other content types. Bodies are only consumed for `post`, `put`, `patch` and `delete` requests.

### Query string

`c.query` parses `?a=1&tags[]=x&tags[]=y` into `{ a: '1', tags: ['x', 'y'] }`. Repeated keys become arrays, `+` decodes to a space, and keys suffixed with `[]` are stripped.

## Response

All response methods return the context, so they chain:

```ts
c.status(201).header('x-request-id', id).json({ ok: true });
```

| Member | Description |
|---|---|
| `c.status(code, message?)` | Set the response status |
| `c.statusCode` | Current status code |
| `c.header(name, value)` / `c.header({...})` | Set one or several response headers |
| `c.type(extOrFilename)` | Set `content-type` from a file extension (`c.type('json')`) |
| `c.respond(body?)` | End the response with an optional `string`/`Buffer` body |
| `c.json(body, status?)` | Serialize through the route's [ResponseSerializer](modules.md#responseserializer) and respond as `application/json` |
| `c.html(body, status?)` | Respond as `text/html` |
| `c.file(path)` | Read a file and respond with its content type, `404` when missing |
| `c.redirect(url)` | `302` redirect |
| `c.ended` | `true` once the response has been sent (or the request aborted) |

Calling any respond method after the response ended is a no-op — never an error. All writes are corked as required by µWebSockets.js.

## Other

| Member | Description |
|---|---|
| `c.log(data)` | Forward to the route's [Logger](modules.md#logger), no-op when none is set |
| `c.mousse` | The Mousse instance that created the context |
| `c.response` | The underlying µWS response, for advanced use |

SSE members (`sustain`, `send`) are documented in [Server-Sent Events](server-sent-events.md). WebSocket route **handlers** receive a different, already-connected `WSContext` — the HTTP `Context` described here is what ws **middlewares** get during the upgrade request ; see [WebSockets](websockets.md).
