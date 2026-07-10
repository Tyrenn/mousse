---
"mousse": minor
---

Documentation generation redesign and robustness fixes.

- `document()` becomes `generateDoc(docgen)`, with new `generateHTMLDoc(options)` and `generateOpenAPIDoc(options)` helpers on every Router
- `SchemaParser` classes replaced by the `DocSchemaTranslator` function type, registered per Standard Schema vendor with `addDocSchemaTranslator(vendor, translate)`; registries merge by union when mounting routers
- Doc generation is now strict by default : a schema vendor without translator throws (opt out with `lenient: true`)
- `DefaultBodyParser` now matches content types carrying parameters (`application/json; charset=utf-8`)
- Routes mounted at a router root (`GET /users` for a `/` route mounted on `/users`) now match correctly
- `c.param()` returns `string` instead of `string | undefined` when the param is declared through schemas or generics
- Middlewares and HTTP error handlers can return the context (`return c.status(401).respond()`)
