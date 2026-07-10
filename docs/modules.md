[« Documentation index](../README.md#documentation)

# Modules

Modules are small, swappable pieces of behavior attached to routes. Each one is a plain interface: bring your own implementation or use the provided defaults.

They can be set at three levels, from lowest to highest precedence:

```ts
// 1. Router/app defaults (constructor options or setters)
const app = new Mousse();
app.setDefaultLogger(myLogger)
	.setDefaultHTTPErrorHandler(myErrorHandler)
	.setDefaultBodyParser(myBodyParser)
	.setDefaultResponseSerializer(mySerializer);

const router = new Router({ logger: routerLogger });

// 2. Route options — override the defaults for this route only
app.get('/special', { logger: specialLogger }, handler);
```

When a router is mounted with `use`, its routes keep their own options; only the ones left undefined inherit the defaults of the target router.

## BodyParser

Turns the raw request body into the value returned by `c.body()`.

```ts
interface BodyParser<SchemaDefault> {
	parse(raw?: Buffer, contentType?: string, schema?: SchemaDefault): Body | Promise<Body>;
}
```

`DefaultBodyParser` handles:

| Content type | Result |
|---|---|
| `application/json` | `JSON.parse` |
| `application/x-www-form-urlencoded` | Parsed key/value record |
| `multipart/form-data` | Record of the non-file fields |
| anything else | The raw `Buffer` |

## ResponseSerializer

Turns the value passed to `c.json()` (or returned by a handler) into a sendable payload.

```ts
interface ResponseSerializer<SchemaDefault> {
	serialize(res?: Response, schema?: SchemaDefault): string | Buffer | ArrayBuffer;
}
```

`DefaultResponseSerializer` is `JSON.stringify`.

The `schema` argument of both interfaces receives the route's `schemas` option, enabling schema-aware implementations — see [Schemas](schemas.md#schemas-and-serializers). The defaults ignore it; validation is performed by Mousse itself either way.

## Logger

```ts
interface Logger {
	log(data?: any): void | Promise<void>;
}
```

Available in handlers as `c.log(data)` (no-op when the route has no logger). Also used to report unhandled route errors when no error handler is set.

## Error handlers

```ts
interface HTTPErrorHandler {
	handle(error: any, c: Context<any>): void | Promise<void>;
}

interface WSErrorHandler {
	handle(error: any): void | Promise<void>;
}
```

`httpErrorHandler` is called when a middleware or handler throws; it may respond through the context. If nothing responded after it ran, Mousse sends a `500`. `wsErrorHandler` covers errors thrown inside WebSocket event listeners.

## DefaultHandler

The catch-all executed when no route matched (see [Routing](routing.md#default-handler-404)):

```ts
interface DefaultHandler {
	handle: Handler<any, any>;
}
```

Unlike the other modules, a `DefaultHandler` is **not assignable to a single route** — "no route matched" is by nature a router-level concern. Set it on the app or a router only, through `setDefaultHandler()` or the `defaultHandler` constructor option.

## What is not a module

Documentation generation (`DocGen`, `DocSchemaTranslator`) is **not** a module: it is an offline pass over the whole route tree, not a per-request behavior, and follows its own registration rules — see [Documentation generation](docgen.md).

---

| [« WebSockets](websockets.md) | [Documentation index](../README.md#documentation) | [Typescript »](typescript.md) |
|:---|:---:|---:|
