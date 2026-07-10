[« Documentation index](../README.md#documentation)

# Server-Sent Events

A Server-Sent Events channel is a **sustained** request: instead of responding once, the connection is kept open and events are pushed through it.

## The `sse` helper

`app.sse` registers a GET route whose context is already sustained when the handler runs:

```ts
app.sse('/notifications', (c) => {
	const interval = setInterval(() => {
		// c.ended becomes true when the client disconnects; send() would throw
		if (c.ended)
			clearInterval(interval);
		else
			c.send({ time: Date.now() });
	}, 1000);
});
```

`c.send(data)` accepts a `string` or an `object` (JSON-serialized) and writes it as an SSE `data:` frame. Writes are queued and flushed with backpressure handling — slow clients never block the event loop.

## Manual sustain

Any `get`, `post`, `put` or `patch` context is *sustainable*. Call `c.sustain()` yourself to open the channel:

```ts
app.get('/events', (c) => {
	c.sustain();
	c.send('hello');
});
```

- `sustain()` throws if the context is not sustainable (or already responded); it is a no-op if already sustained.
- `send()` throws if the context is not sustained or the connection is closed.
- `c.sustained` tells whether the channel is open.

Once a context is sustained, Mousse does not auto-respond after the handler returns: the connection stays open for future `send()` calls.

---

| [« Context](context.md) | [Documentation index](../README.md#documentation) | [WebSockets »](websockets.md) |
|:---|:---:|---:|
