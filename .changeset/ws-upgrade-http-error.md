---
"@tyren/mousse": patch
---

An `HTTPError` thrown by a middleware of a `ws` route now rejects the upgrade with its status and `{error : message}`, like on an HTTP route. It used to answer 500 and log the error, unless the route had an `httpErrorHandler`.
