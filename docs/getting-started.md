# Getting Started

Mousse is an opinionated, fully typed Node.js web framework built on top of [µWebSockets.js](https://github.com/uNetworking/uWebSockets.js). It handles HTTP routing, WebSockets and Server-Sent Events with a single, consistent `Context` API.

## Installation

> **WARNING**: Mousse is a work in progress, no package is published yet. For now, use it from the monorepo workspace:

```json
{
	"dependencies": {
		"mousse": "workspace:*"
	}
}
```

## Hello World

```ts
import { Mousse } from 'mousse';

const app = new Mousse();

app.get('/hello', (c) => {
	return 'Hello from Mousse';
});

app.listen(3000, (listenSocket, port) => {
	if (listenSocket)
		console.log(`Listening on port ${port}`);
	else
		console.log('Failed to listen');
});
```

Every registration method returns the app itself, so the whole application can be chained:

```ts
new Mousse()
	.get('/hello', (c) => 'world')
	.post('/echo', async (c) => await c.body())
	.listen(3000);
```

## TLS

Pass the µWebSockets.js SSL options to the constructor. When both `key_file_name` and `cert_file_name` are provided, Mousse automatically creates an SSL application:

```ts
const app = new Mousse({
	key_file_name: 'misc/key.pem',
	cert_file_name: 'misc/cert.pem',
	passphrase: '1234'
});
```

## Stopping the server

```ts
app.stop();
```

Closes the listen socket. Active connections finish their in-flight work; no new connection is accepted.

## Next steps

- [Routing](routing.md) — routes, routers, middlewares
- [Context](context.md) — the request/response object handed to every handler
- [Schemas](schemas.md) — validation and type inference
- [Documentation generation](docgen.md) — HTML docs and OpenAPI output
- [Testing routes](testing.md) — firing requests against a router with no real port
- [WebSockets](websockets.md)
- [Server-Sent Events](server-sent-events.md)
- [Modules](modules.md) — body parsers, serializers, loggers, error handlers
- [Working with types](typescript.md)
