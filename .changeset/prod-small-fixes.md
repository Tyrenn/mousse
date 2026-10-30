---
"@tyren/mousse": minor
---

Production fixes on Context:

- **Breaking**: route param names keep their declared case. `/offers/:idOffer` is now read with `c.param('idOffer')` (was `idoffer`), matching `Params` schemas and inferred types.
- Multi-valued response headers: `c.header(name, string[])` and new `c.appendHeader(name, value)` write one header line per value, so several `set-cookie` can be sent.
- `c.file()` streams the file with backpressure instead of loading it in memory, answers `404` only for missing files / non regular files and `500` for other errors.
- `del` handlers can read `c.body()` (the body was already consumed, only the type forbade it).
