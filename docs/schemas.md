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
| `Body` | At the first `c.body()` call | `400` |
| `Response` | Inside `c.json()`, before serialization | `500` |

- A route without schemas validates nothing: zero overhead.
- Body validation is lazy by design: a handler that never reads the body never pays for it.
- `Response` schemas must validate **synchronously** (serialization cannot await). Async refinements are fine everywhere else.

## Validation failures

Without a custom error handler, an invalid request gets a `400` with the issues reported by the schema library:

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
import { SchemaValidationError } from 'mousse';

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
serialize(res, schema)               // ResponseSerializer — schema = schemas.Response
```

The defaults ignore it, and validation is handled by Mousse either way — a custom parser does **not** need to validate. The hook exists for schema-aware implementations, typically a serializer compiling the Response schema to a fast stringifier (fast-json-stringify style) instead of a generic `JSON.stringify`.

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
