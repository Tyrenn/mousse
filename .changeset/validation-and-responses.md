---
"@tyren/mousse": minor
---

Validation and responses:

- **Breaking**: a route `Body` schema is validated after the middlewares and before the handler, even when the handler never reads the body (was: at the first `c.body()` call only, so unread invalid bodies passed).
- **Breaking**: a single `Response` schema now only applies to 2xx responses. `c.status(404).json({error})` is no longer validated (and rejected with a 500) against the success schema.
- `Response` accepts a map of schemas per status code or range (`{200 : Offer, '4xx' : ApiError}`), exact codes winning over ranges. Handler returns are typed from 2xx schemas, `c.json()` also accepts the other shapes. OpenAPI and HTML docs list every status.
- Malformed bodies (invalid json...) are answered `400 {error : 'Malformed body'}` (`BodyParseError`) instead of `500`.
- `validationErrorStatus` route / router option (400 by default) for invalid body, query and params.
- Optional `ResponseSerializer.compile(schema)`, called once per response schema at route registration, replaces `serialize()` for matching responses (fast-json-stringify style).
- Handlers may return the context (`return c.status(404).json(...)`) without type errors.
