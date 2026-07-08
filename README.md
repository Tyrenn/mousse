> **WARNING** : This is a work in progress as I rewrite all the code base, no package is yet available

# Mousse : Let us play with bubbles

![tag](https://img.shields.io/badge/version-1.0.0-0082B4.svg)
![tag](https://img.shields.io/badge/licence-MIT-9cf.svg)

Mousse is a Node.js web server framework developed in TypeScript and based on [µWebSockets.js](https://github.com/uNetworking/uWebSockets.js). It provides simple ways to route HTTP requests and handle WebSockets or Server-Sent Events through a single, consistent `Context` API. It uses a middlewares-based structure and handlers as inspired by [expressJS](https://expressjs.com/) and [fastify](https://fastify.dev/).

> In french Mousse refers to soap foam, composed of thousands bubbles : the requests ☁️☁️

## Features

- ⚡ Built on µWebSockets.js, one of the fastest HTTP/WS servers available for Node.js
- 🌐 HTTP routing with parameters, wildcards, route options and composable routers
- 🔌 WebSockets with automatic upgrade, per-route events and backpressure handling
- 📡 Server-Sent Events as sustained requests, with backpressured send queue
- 🧩 Swappable modules per route or per router : body parser, response serializer, logger, error handlers
- 🛡️ Fully typed : request body, response, route params and context extensions
- ✅ Schema validation through [Standard Schema](https://standardschema.dev) : bring your Zod, ArkType or Valibot schemas as-is, get runtime validation and type inference
- 📄 Documentation generation from route schemas : self-styled HTML site or standard OpenAPI 3.1 output
- 🧪 One-call route testing : `router.test()` fires real requests through a single ephemeral instance, no port management

## Quick Start

```ts
import { Mousse } from 'mousse';

new Mousse()
	.get('/hello', (c) => {
		return 'Hello World !';
	})
	.get('/users/:id', (c) => {
		return { id: c.param('id') };
	})
	.post('/echo', async (c) => {
		return await c.body();
	})
	.ws('/chat', (c) => {
		c.onMessage((ws, message) => ws.send(message));
	})
	.sse('/events', (c) => {
		c.send('welcome');
	})
	.listen(3000, (ls, port) => {
		if (ls) console.log(`Listening on port ${port}`);
	});
```

`c` is a `Context` instance : it wraps the request and the response and carries every utility you need. A handler may respond explicitly (`c.respond()`, `c.json()`...) or simply return a value.

## Documentation

- [Getting started](docs/getting-started.md) — installation, hello world, TLS
- [Routing](docs/routing.md) — routes, patterns, middlewares, routers, error handling
- [Context](docs/context.md) — request and response API
- [Schemas](docs/schemas.md) — validation and type inference
- [Documentation generation](docs/docgen.md) — HTML docs and OpenAPI output
- [Testing routes](docs/testing.md) — firing requests against a router with no real port
- [WebSockets](docs/websockets.md) — upgrades, events, backpressure
- [Server-Sent Events](docs/server-sent-events.md) — sustained requests
- [Modules](docs/modules.md) — body parsers, serializers, loggers, error handlers
- [Working with types](docs/typescript.md) — context types and extensions

## Monorepo

| Path | Content |
|---|---|
| [`packages/mousse`](packages/mousse) | The framework |
| [`apps/examples`](apps/examples) | Runnable examples |
| [`apps/benchmarks`](apps/benchmarks) | Benchmarks against express, fastify and raw µWebSockets.js |

## Contributing

> Disclaimer : even though I'm proud of this version, it represents one of my first public, ambitious and TypeScript based modules. Many improvements need to be done and will be, I hope.

I haven't yet decided a clear procedure to contribute to this package. I guess the main contribution you can make for now is to test it and open issues to help me chase the bugs. I will try to fix them as fast as I can while thinking of better implementations for performance gains and new handy features. If this package begins to get big attention, I might invite the most interested people to participate in its design and development.

## License

[MIT](LICENSE)
