[« Documentation index](../README.md#documentation)

# Server-Sent Events

A Server-Sent Events channel is a **sustained** request: instead of responding once, the connection is kept open and events are pushed through it.

## The `sse` helper

`app.sse` registers a GET route whose context is already sustained when the handler runs:

```ts
app.sse('/notifications', { heartbeat: 15000 }, (c) => {
	const interval = setInterval(() => c.send({ time: Date.now() }), 1000);

	// The client went away: release timers and subscriptions
	c.onAbort(() => clearInterval(interval));
});
```

## Sending events

`c.send(data, options?)` accepts a `string` or an `object` (JSON-serialized). Multi-line strings are split into one `data:` line each, as the spec requires. Options add the other SSE fields:

```ts
c.send({ id: 7, status: 'shipped' }, {
	event: 'order',     // dispatched to addEventListener('order') on the client
	id: 7,              // sent back as last-event-id when the client reconnects
	retry: 5000         // client reconnection delay, ms
});
```

Line breaks in `event` and `id` are removed, so they cannot forge extra fields. Writes are queued and flushed with backpressure handling — slow clients never block the event loop.

`c.ping()` sends a comment frame (`:`), ignored by clients. The `heartbeat` option (milliseconds, on `app.sse` or `c.sustain({ heartbeat })`) sends one periodically, which keeps proxies and load balancers from closing idle streams. The `x-accel-buffering: no` header is set so nginx does not hold events back.

## Ending the stream

- **Client side**: when the client disconnects, `c.ended` and `c.aborted` become `true` and every `c.onAbort(listener)` runs. Always clean up there: a forgotten interval or subscription leaks for the life of the process.
- **Server side**: `c.respond()` ends the stream.

Both are reported to [onResponse hooks](routing.md#response-hooks), with `aborted: true` for a client disconnection.

## Manual sustain

Any `get`, `post`, `put` or `patch` context is *sustainable*. Call `c.sustain()` yourself to open the channel:

```ts
app.get('/events', (c) => {
	c.sustain();
	c.send('hello');
});
```

- `sustain()` sends the status and headers right away, including those set by middlewares (CORS...).
- `sustain()` throws if the context is not sustainable (or already responded); it is a no-op if already sustained.
- `send()` throws if the context is not sustained or the connection is closed. `ping()` is a no-op then.
- `c.sustained` tells whether the channel is open.

Once a context is sustained, Mousse does not auto-respond after the handler returns: the connection stays open for future `send()` calls.

---

| [« Context](context.md) | [Documentation index](../README.md#documentation) | [WebSockets »](websockets.md) |
|:---|:---:|---:|
