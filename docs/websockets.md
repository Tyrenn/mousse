[« Documentation index](../README.md#documentation)

# WebSockets

A `ws` route separates two phases, each with its own context:

1. **Upgrade phase** — the *middlewares* run on the HTTP upgrade request, with a regular HTTP [`Context`](context.md). Respond through it (`c.status(401).respond()`...) to **reject** the connection. If no middleware responds, Mousse upgrades automatically.
2. **Connected phase** — the *handler* runs once the connection is established, with a `WSContext`: the socket is already open, `c.send()` works immediately — just as `sse` handlers receive an already-sustained context.

```ts
app.ws('/chat/:room', (c) => {
	// c is a WSContext: already connected
	c.subscribe(c.param('room'));
	c.send(`welcome to ${c.param('room')}`);

	c.onMessage((ws, message) => {
		c.publish(c.param('room'), message);
	});
});
```

## Rejecting an upgrade

Anything you would do in a `get` handler (read headers, query, check auth, respond) belongs in a middleware of the ws route:

```ts
app.ws('/private',
	(c) => {
		// HTTP Context of the upgrade request
		if (!c.getHeader('authorization'))
			return c.status(401).respond(); // upgrade rejected
	},
	(c) => {
		// WSContext: only reached when no middleware responded
		c.send('authenticated and connected');
	});
```

> µWebSockets.js only accepts upgrades on patterns registered through its ws router — a plain `get` route cannot upgrade. Upgrade middlewares are the supported way to run HTTP logic before a connection.

## WSContext

The connected context exposes the socket, the original request data (snapshotted at upgrade time), and event registration:

| Member | Description |
|---|---|
| `c.send(message, isBinary?, compress?)` | Send to this socket, backpressure handled (see below) |
| `c.subscribe(topic)` / `c.unsubscribe(topic)` | µWS pub/sub topics |
| `c.publish(topic, message, ...)` | Publish to this **route's** subscribers, excluding the sender |
| `c.mousse.publish(topic, message, ...)` | Publish **app-wide** (all ws routes), including the sender |
| `c.end(code?, message?)` | Gracefully close the connection |
| `c.params`, `c.param()`, `c.query`, `c.headers`, `c.getHeader()`, `c.url`, `c.route` | Data of the original upgrade request |
| `c.on(event, listener)` / `c.off(event)` + shortcuts below | Event registration |
| `c.socket` | The native µWS socket, for advanced use |
| `c.log(data)` | Route logger, no-op when none is set |

> **Topic scoping**: µWebSockets.js keeps one topic tree per ws route. `c.publish` therefore only reaches subscribers of the same route pattern (and skips the sender) — the classic chat-room case. For broadcasting across routes, or including the sender, use `c.mousse.publish`.

## Events

Register listeners synchronously inside the handler — a listener registered after an `await` can miss early events:

| Shortcut | Signature | Fired |
|---|---|---|
| `onMessage` | `(ws, message, isBinary?)` | Message received |
| `onClose` | `(ws, code, message)` | Connection closed |
| `onPing` / `onPong` | `(ws, message)` | Ping/pong received |
| `onDrain` | `(ws)` | Backpressure drained |
| `onDropped` | `(ws, message, isBinary?)` | Message dropped because of backpressure |
| `onSubscription` | `(ws, topic, newCount, oldCount)` | Pub/sub subscription change |

One listener per event: registering twice replaces the first. The `ws` argument is the native socket; in practice you rarely need it since the listener closes over `c`:

```ts
c.onMessage((ws, message) => c.send(message)); // echo
```

## Backpressure

`c.send` never overflows a slow client: when the socket buffer exceeds the route's `maxBackPressure` (default 16 KiB), messages are queued and flushed automatically, in order, on drain.

```ts
app.ws('/feed', { maxBackPressure: 64 * 1024 }, (c) => { /* ... */ });
```

## Error handling

- Errors thrown by upgrade **middlewares** go through the route's `httpErrorHandler`, then a `500` fallback — like any HTTP route.
- Errors thrown by the **handler** or inside event listeners go through the route's `wsErrorHandler`, or `console.error` when none is set:

```ts
app.ws('/chat', { wsErrorHandler: { handle: (error) => report(error) } }, (c) => { /* ... */ });
```

---

| [« Server-Sent Events](server-sent-events.md) | [Documentation index](../README.md#documentation) | [Modules »](modules.md) |
|:---|:---:|---:|
