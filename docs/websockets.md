# WebSockets

Register a WebSocket route with `ws`. The handler runs during the **upgrade request**: it receives a regular HTTP `Context` where you attach the socket event listeners. If the handler completes without responding, Mousse upgrades the connection automatically.

```ts
app.ws('/chat/:room', (c) => {
	const room = c.param('room');

	c.onOpen((ws) => {
		ws.subscribe(room);
		ws.send(`welcome to ${room}`);
	});

	c.onMessage((ws, message, isBinary) => {
		ws.publish(room, message);
	});

	c.onClose((ws, code, message) => {
		console.log('closed', code);
	});
});
```

Since the upgrade context is a full HTTP context, middlewares and route options apply as usual — reject an upgrade by responding:

```ts
app.ws('/private', authMiddleware, (c) => {
	if (!c.getHeader('authorization'))
		return c.status(401).respond();

	c.onMessage((ws, message) => ws.send(message));
});
```

## Events

Listeners are registered on the context with `c.on(event, listener)` or the dedicated shortcuts:

| Shortcut | Signature | Fired |
|---|---|---|
| `onOpen` | `(ws)` | Connection established |
| `onMessage` | `(ws, message, isBinary?)` | Message received |
| `onClose` | `(ws, code, message)` | Connection closed |
| `onPing` / `onPong` | `(ws, message)` | Ping/pong received |
| `onDrain` | `(ws)` | Backpressure drained |
| `onDropped` | `(ws, message, isBinary?)` | Message dropped because of backpressure |
| `onSubscription` | `(ws, topic, newCount, oldCount)` | Pub/sub subscription change |

`c.off(event)` removes a listener. One listener per event: registering twice replaces the first.

The `ws` object handed to listeners is the native µWebSockets.js socket — `subscribe`, `publish`, `getUserData`, `end` and friends are all available.

## Backpressure

`ws.send` is wrapped by Mousse: when the socket buffer exceeds the route's `maxBackPressure` (default 16 KiB), messages are queued and flushed automatically on drain, in order.

```ts
app.ws('/feed', { maxBackPressure: 64 * 1024 }, (c) => {
	c.onOpen((ws) => { /* ... */ });
});
```

## Error handling

Errors thrown during the upgrade go through the route's `httpErrorHandler` (then a `500` fallback). Errors thrown inside socket listeners go through the route's `wsErrorHandler`, or `console.error` when none is set:

```ts
app.ws('/chat', {
	wsErrorHandler: { handle: (error) => report(error) }
}, (c) => { /* ... */ });
```

## Manual upgrade

`c.upgrade()` can be called explicitly to upgrade early inside the handler. `c.upgradable` tells whether the context can upgrade, `c.upgraded` whether it already did. Calling `upgrade()` twice is a no-op.
