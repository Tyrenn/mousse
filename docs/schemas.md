[« Documentation index](../README.md#documentation)

# Schemas: validation, typing and documentation

Routes accept a `schemas` option describing the request and response data. Mousse uses it for three things:

1. **Runtime validation** — invalid requests are rejected before your handler runs
2. **Static typing** — handler types are inferred from the schemas, no generics to write
3. **Documentation** — the same schemas feed the [documentation generators](docgen.md)

## Standard Schema

Mousse validates through the [Standard Schema](https://standardschema.dev) interface, implemented natively by **Zod** (>= 3.24), **ArkType**, **Valibot** and a growing list of libraries. Any schema from these libraries works directly — no adapter, no plugin, and Mousse itself depends on none of them:

```ts
import { z } from 'zod';
import { type } from 'arktype';

// Both are valid Mousse schemas as-is
const zodUser = z.object({ name: z.string(), age: z.number() });
const arkUser = type({ name: 'string', age: 'number' });
```

## Attaching schemas to a route

```ts
import { z } from 'zod';

app.post('/orgs/:org/users', {
	schemas: {
		Body: z.object({ name: z.string().trim(), email: z.string().email() }),
		Query: z.object({ dryrun: z.coerce.boolean().optional() }),
		Params: z.object({ org: z.string() }),
		Response: z.object({ id: z.number() })
	}
}, async (c) => {
	const body = await c.body();   // { name: string; email: string } — validated AND typed
	c.query.dryrun;                // boolean | undefined — coerced by the schema
	c.param('org');                // parameter names checked at compile time
	return { id: 1 };              // must match the Response schema
});
```

Handler and middleware types are **inferred from the schemas**: no explicit generics needed. Transformations declared in schemas (trim, coercion, defaults...) are applied — your handler receives the schema **output**.

## What is validated, and when

| Part | Validated | On failure |
|---|---|---|
| `Params` | Before any middleware runs | `400` |
| `Query` | Before any middleware runs | `400` |
| `Body` | After the middlewares, before the handler (or earlier, at the first `c.body()` call of a middleware) | `400` |
| `Response` | Inside `c.json()`, before serialization, against the schema of the final status | `500` |

- A route without schemas validates nothing: zero overhead.
- The handler always receives a validated body, even if it never reads it. Middlewares run first, so an authentication middleware rejects a request before its body is parsed and validated. `c.body(true)` stays the raw, unvalidated `Buffer` (webhook signatures...).
- A body the parser cannot read (malformed json) is a `400 { "error": "Malformed body" }`, whether the route has a schema or not.
- `Response` schemas must validate **synchronously** (serialization cannot await). Async refinements are fine everywhere else.

## Responses per status

A single `Response` schema describes **2xx** responses. To describe others, key schemas by status code or range — exact codes win over ranges:

```ts
app.get('/offers/:idOffer', {
	schemas: {
		Params: z.object({ idOffer: z.string() }),
		Response: {
			200: Offer,
			'4xx': z.object({ error: z.string() })
		}
	}
}, async (c) => {
	const offer = await findOffer(c.param('idOffer'));
	if (!offer)
		return c.status(404).json({ error: 'Offer not found' });   // typed and validated against '4xx'
	return offer;                                                // typed and validated against 200
});
```

A status with no matching schema is sent unvalidated. Handler return values are typed from the 2xx schemas; `c.json()` also accepts the other shapes. The documentation generators list every status.

## Undeclared fields

Response validation sends the schema **output**, so whether undeclared fields reach the client depends on the library: Zod `z.object` and Valibot `v.object` strip them, ArkType keeps them unless told otherwise (`type({ '+': 'delete', id: 'string' })`). Use stripping objects for responses built from database rows to avoid leaking fields such as password hashes.

## Validation failures

Without a custom error handler, an invalid request gets a `400` (or the `validationErrorStatus` route / router option, e.g. `422`) with the issues reported by the schema library:

```json
{
	"error": "Invalid body",
	"issues": [
		{ "message": "name must be a string", "path": ["name"] }
	]
}
```

An invalid **response** is a server bug: the client gets an empty `500` and the error is logged.

To customize this behavior, set an `httpErrorHandler` (per route or as a router default) and check for `SchemaValidationError`:

```ts
import { SchemaValidationError } from '@tyren/mousse';

const errorHandler = {
	handle: (error, c) => {
		if (error instanceof SchemaValidationError)
			return c.status(422).json({ part: error.part, issues: error.issues });

		c.status(500).respond();
	}
};
```

`error.part` is one of `'body' | 'query' | 'params' | 'response'`.

## Schemas and serializers

The route's [BodyParser and ResponseSerializer](modules.md) receive the relevant schema as an argument:

```ts
parse(raw, contentType, schema)      // BodyParser — schema = schemas.Body
serialize(res, schema)               // ResponseSerializer — schema = the Response schema of the status
compile(schema)                      // ResponseSerializer, optional — once per Response schema at startup
```

The defaults ignore it, and validation is handled by Mousse either way — a custom parser does **not** need to validate.

A serializer implementing `compile` gets each Response schema once, when the route is registered, and returns the function used for every response matching it: no per-request lookup, and an unsupported schema fails at startup instead of on the first request. Typical use is [fast-json-stringify](https://github.com/fastify/fast-json-stringify), which also drops undeclared fields, fed by a [DocSchemaTranslator](docgen.md):

```ts
import fastJson from 'fast-json-stringify';
import { z } from 'zod';

app.setDefaultResponseSerializer({
	serialize: (res) => JSON.stringify(res ?? {}),      // responses without schema
	compile: (schema) => fastJson(z.toJSONSchema(schema))
});
```

## Typing without schemas

Schemas are optional. Routes without them fall back to the explicit generic form described in [Typescript](typescript.md):

```ts
app.post<MyContextTypes>('/legacy', handler);
```

Note: when `schemas` is provided, inference always wins over explicit generics on the helper methods.

## Documentation generation

The second purpose of route schemas is documentation — see [Documentation generation](docgen.md) for the full pipeline: one `DocSchemaTranslator` per schema library, OpenAPI 3.1 output, and Mousse's own HTML renderer.

---

| [« Typescript](typescript.md) | [Documentation index](../README.md#documentation) | [Testing routes »](testing.md) |
|:---|:---:|---:|
