# Mousse : Let us play with bubbles

Mousse is a Node.js web server framework developed in TypeScript and based on [µWebSockets.js](https://github.com/uNetworking/uWebSockets.js). It provides simple ways to route HTTP requests and handle WebSockets or Server-Sent Events through a single, consistent `Context` API.

- ⚡ Built on µWebSockets.js, one of the fastest HTTP/WS servers available for Node.js
- 🌐 HTTP routing with parameters, wildcards, route options and composable routers
- 🔌 WebSockets and 📡 Server-Sent Events with backpressure handling
- 🛡️ Fully typed, ✅ [Standard Schema](https://standardschema.dev) validation (Zod, ArkType, Valibot...)
- 📄 Documentation generation : self-styled HTML site or OpenAPI 3.1
- 🧪 One-call route testing through a single ephemeral instance

```sh
pnpm add @tyren/mousse    # or npm install @tyren/mousse
```

```ts
import { Mousse } from '@tyren/mousse';

new Mousse()
	.get('/hello', (c) => 'Hello World !')
	.get('/users/:id', (c) => ({ id: c.param('id') }))
	.ws('/chat', (c) => c.onMessage((ws, message) => { c.send(message); }))
	.sse('/events', (c) => c.send('welcome'))
	.listen(3000);
```

Full documentation, examples and benchmarks : [github.com/Tyrenn/mousse](https://github.com/Tyrenn/mousse#documentation)

## License

[MIT](LICENSE)
