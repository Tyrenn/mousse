[« Documentation index](../README.md#documentation)

# Getting started

Mousse is a Node.js web framework written in TypeScript, built on [µWebSockets.js](https://github.com/uNetworking/uWebSockets.js). HTTP routes, WebSockets and Server-Sent Events all go through one `Context` API, with the middlewares and handlers you know from [Express](https://expressjs.com/) and [Fastify](https://fastify.dev/).

> In French, *mousse* is soap foam : thousands of bubbles, the requests 🫧

## Installation

```sh
pnpm add @tyren/mousse    # or npm install @tyren/mousse
```

µWebSockets.js ships prebuilt binaries only. It supports **Node.js 22, 24 and 26** on **glibc** Linux (x64, arm64), macOS and Windows. Alpine (musl) and odd Node versions (23, 25) fail at import with an explicit error : use a glibc image such as `node:24-slim`.

It is installed from GitHub rather than npm, so package managers blocking git dependencies have to allow it.

## Your first route

```ts
import { Mousse } from '@tyren/mousse';

new Mousse()
	.get('/hello', (c) => 'Hello World !')
	.listen(3000, (listenSocket, port) => {
		if (listenSocket) console.log(`Listening on port ${port}`);
	});
```

```sh
curl http://localhost:3000/hello    # Hello World !
```

`c` is the `Context` : it wraps the request and the response, and carries everything a handler needs. A handler returns a value, or answers itself:

```ts
import { Mousse } from '@tyren/mousse';

new Mousse()
	.get('/users/:id', (c) => ({ id: c.param('id') }))       // an object is sent as json
	.post('/echo', async (c) => await c.body())              // the body is parsed for you
	.get('/teapot', (c) => c.status(418).respond('Short and stout'))
	.listen(3000);
```

Every registration method returns the app, so a whole application can be chained. `app.stop()` closes the listen socket and lets in-flight work finish.

Continue with [Routing](routing.md) and [Context](context.md).

## Middlewares and routers

A middleware receives the same `Context` as the handler. It runs before the handler, and answering or throwing ends the request : nothing after it runs.

```ts
import { Mousse, Router, HTTPError } from '@tyren/mousse';

const admin = new Router()
	.use((c) => {
		if (!c.getHeader('authorization'))
			return c.status(401).respond();
	})
	.del('/users/:id', (c) => {
		if (c.param('id') === '0')
			throw new HTTPError(404, 'No such user');
		return { deleted: c.param('id') };
	});

new Mousse()
	.use('/admin', admin)     // DELETE /admin/users/:id
	.listen(3000);
```

## Validation and types

Attach [Standard Schema](https://standardschema.dev) schemas (Zod, ArkType, Valibot...) to a route : requests are validated at runtime and the handler is typed from them, with no generics to write.

```ts
import { Mousse } from '@tyren/mousse';
import { z } from 'zod';

new Mousse()
	.post('/orgs/:org/users', {
		schemas: {
			Body: z.object({ name: z.string(), email: z.email() }),
			Response: z.object({ id: z.number() })
		}
	}, async (c) => {
		const body = await c.body();   // { name: string; email: string }, validated and typed
		console.log(body.name);
		return { id: 1 };              // must match the Response schema
	})
	.listen(3000);
```

The same schemas feed the [documentation generators](docgen.md). See [Schemas](schemas.md) for what is validated and when.

## WebSockets and Server-Sent Events

Real-time channels use the same routing and `Context` API. A `ws` route separates the **upgrade phase**, plain HTTP middlewares that can refuse the connection, from the **connected phase**, where the handler gets an open socket with events, pub/sub and backpressure handling.

```ts
import { Mousse } from '@tyren/mousse';

new Mousse()
	.ws<{ Params: 'room' }>('/chat/:room',
		(c) => {
			if (!c.getHeader('authorization'))
				return c.status(401).respond();   // upgrade refused
		},
		(c) => {
			c.subscribe(c.param('room'));
			c.onMessage((ws, message) => { c.publish(c.param('room'), message); });
		})
	.sse('/events', (c) => c.send('welcome'))
	.listen(3000);
```

See [WebSockets](websockets.md) and [Server-Sent Events](server-sent-events.md).

## Testing your routes

No port to manage : `testRouter` fires real requests through a single ephemeral instance.

```ts
import { Router, testRouter } from '@tyren/mousse';

const users = new Router().get('/users/:id', (c) => ({ id: c.param('id') }));

await testRouter(users, async (client) => {
	const response = await client.get('/users/1');
	console.log(await response.json());   // { id: '1' }
});
```

See [Testing routes](testing.md).

## Going to production

### TLS

Pass the µWebSockets.js SSL options to the constructor. When both `key_file_name` and `cert_file_name` are provided, Mousse creates an SSL application:

```ts
import { Mousse } from '@tyren/mousse';

const app = new Mousse({
	key_file_name: 'misc/key.pem',
	cert_file_name: 'misc/cert.pem',
	passphrase: '1234'
});
```

### Behind a proxy

Behind a load balancer or reverse proxy, declare which peers may set `x-forwarded-for`, `x-forwarded-proto` and `x-forwarded-host`. Nothing is trusted by default.

```ts
import { Mousse } from '@tyren/mousse';

const app = new Mousse({
	trustProxy: ['loopback', '10.0.0.0/8']   // IPs, CIDR ranges, 'loopback' / 'private' / 'linklocal', or (ip) => boolean
});

app.get('/whoami', (c) => ({ ip: c.ip, ips: c.ips, protocol: c.protocol, host: c.host }));
```

`c.ip` walks `x-forwarded-for` from the right and stops at the first address that is not a trusted proxy, so a client cannot spoof it by sending its own header.

### Rate limiting

Set a limiter per route or per router, in memory or on Redis. It runs before anything of the request is parsed. See [Rate limiting](rate-limiting.md).

## Philosophy

- **One way to write it all.** HTTP, WebSockets and Server-Sent Events share routing, middlewares and the `Context`. What you learn for one holds for the others.
- **Stay close to the metal.** Mousse aims to keep the speed of raw µWebSockets.js while adding routing, validation and the `Context` API. `pnpm bench` measures it against the others.
- **Types come from your schemas.** A schema validates at runtime and types the handler, and any Standard Schema library fits. You should not have to write the same thing twice.
- **Everything is replaceable.** Body parser, serializer, logger, error handlers and rate limiter are [modules](modules.md) : small interfaces set per route or per router, with a default you can swap.
- **Refuse early, fail loud.** What is cheap to refuse is refused first, and an error is never an implicit `200`.
- **Examples are tests.** The [examples](../apps/examples/src) run against the current code in the test suite, so they keep working.

---

| [« README](../README.md) | [Documentation index](../README.md#documentation) | [Routing »](routing.md) |
|:---|:---:|---:|
