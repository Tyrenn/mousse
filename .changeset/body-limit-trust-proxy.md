---
"@tyren/mousse": minor
---

Production safety:

- `bodyLimit` route / router option (bytes, 1 MiB by default). A declared `content-length` above it is answered `413` before middlewares run; a body growing past it while received (chunked, lying `content-length`) makes `c.body()` throw a `PayloadTooLargeError` (`413`). Extra chunks are dropped, never buffered.
- `trustProxy` Mousse option (IPs, CIDR ranges, `loopback` / `private` / `linklocal` aliases, `true` or a predicate) and new `c.ip`, `c.ips`, `c.protocol`, `c.host`. `x-forwarded-for` is walked from the right, stopping at the first untrusted hop. `WSContext.ip` exposes the address resolved at upgrade.
- `HTTPError(statusCode, message)`: thrown from a middleware or handler, answered with its status and `{ error: message }` when no `httpErrorHandler` is set.
