[« Documentation index](../README.md#documentation)

# Documentation generation

Mousse turns route [schemas](schemas.md) into documentation. Two built-in outputs are available: a self-styled HTML site (`generateHTMLDoc`), and a standard OpenAPI 3.1 document (`generateOpenAPIDoc`) for external tooling. Both read the same route metadata — nothing to duplicate. Both exist on any `Router`, so a sub-router can be documented on its own, and on the app itself.

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

## DocSchemaTranslator: schema → JSON Schema

Validation goes through [Standard Schema](schemas.md) directly and needs nothing extra. Documentation needs the actual **shape** of a schema, which Standard Schema does not expose — that is what a `DocSchemaTranslator` is for: one small function per schema library, translating a schema to JSON Schema.

```ts
type DocSchemaTranslator = (schema: StandardSchemaV1) => JsonSchema;
```

Translators are registered on the router (or the app) under their library's **vendor** string, one translator per vendor:

```ts
import { z } from 'zod';
import { arkTypeDocSchemaTranslator } from '@tyren/mousse';

app.addDocSchemaTranslator('zod', z.toJSONSchema);              // Zod >= 3.24 exposes this natively
app.addDocSchemaTranslator('arktype', arkTypeDocSchemaTranslator);  // ready-made helper
```

Mousse stays dependency-free: it never imports a schema library itself, you hand it the translate function.

> **Vendors**: the vendor is not a Mousse convention — it is a **required field of the Standard Schema spec** (`schema['~standard'].vendor`), self-declared by every conforming library: `'zod'`, `'arktype'`, `'valibot'`... The key you register a translator under must match that exact string; a translator registered under the wrong vendor is never picked. Mousse reads the vendor from each route schema automatically, and the strict-mode error (below) reports the precise missing string, so a typo surfaces immediately.

When a router is mounted with `use`, its translators are merged into the target by union — a vendor already registered on the target is kept. A feature router can therefore ship its own translators and be documented from the app without extra setup.

## Generating

```ts
await app.generateHTMLDoc({ outputDir: './docs-output', title: 'My API' });
// -> ./docs-output/index.html + router/ + model/ pages

await app.generateOpenAPIDoc({ outputDir: './docs-output', info: { title: 'My API', version: '1.0.0' } });
// -> ./docs-output/openapi.json
```

Both accept a `translators` option (`Record<vendor, DocSchemaTranslator>`) taking precedence over the router registry for that call.

### Strict by default

If a route schema uses a vendor with **no registered translator**, generation **throws**, listing every missing vendor at once:

```
No DocSchemaTranslator registered for vendor(s) 'zod'. Register one with
addDocSchemaTranslator(vendor, translator) or through the 'translators' option,
or set 'lenient : true' to document these schemas as 'any'.
```

This prevents silently shipping a documentation full of `any`. Pass `lenient: true` to fall back to `any` (HTML) or an empty schema (OpenAPI) instead.

## OpenAPI output

`generateOpenAPIDoc` writes an OpenAPI 3.1 json document. `:param` patterns are converted to `{param}`, `Body` becomes `requestBody`, `Query`/`Params` become `parameters`, `Response` becomes the `200` response. WebSocket routes have no OpenAPI equivalent and are skipped.

`toOpenAPI(httproutes, options)` remains available as a pure function — it assembles the document as plain data, no file I/O, usable with any renderer (or none).

## HTML output

`generateHTMLDoc` renders Mousse's own documentation site — colored route cards per verb, collapsible responses, highlighted TypeScript-style model views. No Swagger UI, no external renderer. It produces:

```
docs-output/
	index.html
	router/
		users.html       # one page per doc.tags[0] group ("Users")
		api.html         # routes without a tag fall into "API"
	model/
		models.html      # named $defs / definitions referenced by a route, one page
```

A schema property using `$ref` (a named `$defs`/`definitions` entry) links to its shape rather than inlining it — model pages only include entries actually referenced by a documented route, so the models page never grows with unused types.

## Writing your own generator

Both outputs are just implementations of the same `DocGen` interface, run through `generateDoc` — swap or extend freely:

```ts
interface DocGen {
	toDocumentation(
		httproutes: HTTPRoute[],
		wsroutes: WSRoute[],
		translators?: Map<string, DocSchemaTranslator>  // the calling router's registry
	): void | Promise<void>;
}

await app.generateDoc(myCustomDocGen);
```

`translateSchema`, `missingDocSchemaVendors` and `assertDocSchemaTranslators` are exported for custom generators wanting the same translation and strictness behavior. `src/docgen/jsonschema.ts` (`jsonSchemaToView`, `extractModels`) is reusable on its own if you only need the JSON Schema → TypeScript-view rendering, without the rest of `HTMLDocGen`.

---

| [« Testing routes](testing.md) | [Documentation index](../README.md#documentation) | [README »](../README.md) |
|:---|:---:|---:|
