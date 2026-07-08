# Documentation generation

Mousse turns route [schemas](schemas.md) into documentation. Two independent outputs are available: a self-styled HTML site, and a standard OpenAPI 3.1 document for external tooling. Both read the same route metadata — nothing to duplicate.

## Route metadata

Beyond `schemas`, a route accepts a `doc` option feeding the generators:

```ts
app.post('/orgs/:org/users', {
	schemas: { Body, Response },
	doc: {
		summary: 'Create a user',
		description: 'Creates a user within the organization.',
		tags: ['Users']   // first tag groups the route in both outputs
	}
}, handler);
```

`doc` is entirely optional — routes without it are still documented, just without summary/description/grouping.

## SchemaParser : schema → JSON Schema

Validation goes through [Standard Schema](schemas.md) directly and needs nothing extra. Documentation needs the actual **shape** of a schema, which Standard Schema does not expose — that is what `SchemaParser` is for : one small adapter per schema library, translating a schema to JSON Schema.

```ts
interface SchemaParser {
	vendor: string;                              // matched against schema['~standard'].vendor
	toJsonSchema(schema: StandardSchemaV1): JsonSchema;
}
```

Both generators take a `schemaParsers` array and pick the matching parser by vendor.

### ArkType

ArkType types expose `toJsonSchema()` natively — `ArkTypeSchemaParser` needs nothing else:

```ts
import { ArkTypeSchemaParser } from 'mousse';

const parsers = [new ArkTypeSchemaParser()];
```

### Zod

Zod (>= 3.24) exposes `z.toJSONSchema()` as a standalone function. Wrap it with `CustomSchemaParser`, mousse stays dependency-free either way:

```ts
import { z } from 'zod';
import { CustomSchemaParser } from 'mousse';

const parsers = [new CustomSchemaParser('zod', (schema) => z.toJSONSchema(schema as any))];
```

### Any other library

Same pattern : `CustomSchemaParser(vendor, translate)`, `vendor` matching the string reported by that library's Standard Schema implementation.

A route whose schema has no matching parser is simply documented as `any` — nothing throws.

## OpenAPI output

`toOpenAPI(httproutes, options)` assembles a plain OpenAPI 3.1 document from an array of `HTTPRoute` — pure data, no file I/O, usable with any renderer (or none). `OpenAPIDocGen` is the file-writing wrapper built on it, run through `app.document()` :

```ts
import { OpenAPIDocGen } from 'mousse';

await app.document(new OpenAPIDocGen({
	outputDir: './docs-output',
	schemaParsers: parsers,
	info: { title: 'My API', version: '1.0.0' }
}));
// -> ./docs-output/openapi.json
```

`:param` patterns are converted to `{param}`, `Body` becomes `requestBody`, `Query`/`Params` become `parameters`, `Response` becomes the `200` response. WebSocket routes have no OpenAPI equivalent and are skipped.

## HTML output

`HTMLDocGen` renders Mousse's own documentation site — colored route cards per verb, collapsible responses, highlighted TypeScript-style model views. No Swagger UI, no external renderer :

```ts
import { HTMLDocGen } from 'mousse';

await app.document(new HTMLDocGen({
	outputDir: './docs-output',
	schemaParsers: parsers,
	title: 'My API'
}));
```

This produces:

```
docs-output/
	index.html
	router/
		users.html      # one page per doc.tags[0] group ("Users")
		system.html      # routes without a tag fall into "API"
	model/
		models.html      # named $defs / definitions referenced by a route, one page
```

A schema property using `$ref` (a named `$defs`/`definitions` entry) links to its shape rather than inlining it — model pages only include entries actually referenced by a documented route, so the models page never grows with unused types.

## Writing your own generator

Both outputs are just implementations of the same `DocGen` interface — swap or extend freely:

```ts
interface DocGen {
	toDocumentation(httproutes: HTTPRoute[], wsroutes: WSRoute[]): void | Promise<void>;
}

app.document(myCustomDocGen);
```

`src/docgen/jsonschema.ts` (`jsonSchemaToView`, `extractModels`) is reusable on its own if you only need the JSON Schema → TypeScript-view rendering, without the rest of `HTMLDocGen`.
