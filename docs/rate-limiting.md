[« Documentation index](../README.md#documentation)

# Rate limiting

Rate limiting is a [module](modules.md) set per route or per router, like a body parser. It is off until you set one. Mousse provides `DefaultRateLimiter`, whose options, headers and defaults follow [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit), and any other implementation of the [interface](#custom-rate-limiter) fits.

```ts
import { Mousse, DefaultRateLimiter } from '@tyren/mousse';

new Mousse()
	// Every route registered below : 100 requests per minute, per client
	.setDefaultRateLimiter(new DefaultRateLimiter({ max: 100, timeWindow: '1 minute' }))
	// This route has its own limit instead
	.post('/login', { rateLimiter: new DefaultRateLimiter({ max: 5, timeWindow: '15 minutes' }) }, (c) => ({ token: 'abc' }))
	.listen(3000);
```

The 6th request to `/login` within 15 minutes is answered:

```
HTTP/1.1 429 Too Many Requests
x-ratelimit-limit: 5
x-ratelimit-remaining: 0
x-ratelimit-reset: 840
retry-after: 840

{"error":"Rate limit exceeded, retry in 14 minutes"}
```

> **Running behind a proxy or load balancer ?** Configure `trustProxy` first, see [Behind a proxy](#behind-a-proxy). Otherwise all your users share one counter.

## Scopes

An instance **owns its counters**. Where you set it decides what it covers:

```ts
const limiter = new DefaultRateLimiter({ max: 100 });

app.setDefaultRateLimiter(limiter);              // every route registered afterwards, and the default handler
new Router({ rateLimiter: limiter });            // every route of this router
app.get('/report', { rateLimiter: limiter }, handler);   // this route

app.get('/health', { rateLimiter: false }, handler);     // disables the inherited limiter
```

A route **replaces** the limiter of its router, it does not add to it. A mounted router keeps its limiter, and inherits the one of its parent if it has none.

| Need | How |
|---|---|
| One counter for all the routes of a router | `new Router({ rateLimiter })` |
| One counter per route of a router | Add the route to the key : `keyGenerator: (c) => `${c.ip}:${c.route}`` |
| One counter for some unrelated routes | Set the same instance on each of them |
| A different limit on one route | Set another instance on it |
| A route exempted from the limit | `{ rateLimiter: false }` |
| Limits per user | [After authentication](#after-authentication) |

```ts
// Both routes draw from the same 3 requests per hour
const otp = new DefaultRateLimiter({ max: 3, timeWindow: '1 hour' });

app.post('/otp/send', { rateLimiter: otp }, sendHandler);
app.post('/otp/resend', { rateLimiter: otp }, resendHandler);
```

Mounting a router on several prefixes keeps a single instance, so these prefixes share their counters. Create one router per prefix if they must not.

`setDefaultRateLimiter()` applies to routes registered and routers mounted after it : call it first, like the other `setDefault*` methods.

## When it runs

The rate limiter runs **before anything of the request is analysed**:

1. [Request hooks](routing.md#request-hooks)
2. **Rate limiter**
3. Body limit
4. `Params` and `Query` schemas
5. Middlewares
6. `Body` schema
7. Handler

Every request is therefore counted, including those with invalid params, query or body, or a body too large. Once a client is over the limit, schemas do not run for it anymore, which matters when they are expensive (an async refinement querying a database, say).

### After authentication

Since it runs first, the limiter does not know who is calling : its key can only come from the address or the headers. To limit per user, call it from a middleware placed after your authentication, instead of or on top of the address based limit:

```ts
const perUser = new DefaultRateLimiter({
	max: 50,
	keyGenerator: (c) => c.user.id
});

app.use(authMiddleware);
app.get('/reports', (c) => perUser.check(c), handler);
```

A request reaching the same instance twice counts once.

### WebSockets and Server-Sent Events

On a `ws` route, the limiter runs on the upgrade request : the client gets the `429` like on any route, and the upgrade does not happen.

On an `sse` route, the option answers its `429` before the stream opens. Called from a middleware instead, it runs once the stream is open : the `200` is already sent, so a rejected client only sees its stream close, and an `EventSource` reconnects by itself. Prefer the option.

## Behind a proxy

Clients are identified by `c.ip`. Behind a proxy, a load balancer or a CDN, the socket peer is that proxy : by default, `c.ip` is its address and **all your users share one counter**. One busy client then gets everybody rejected.

Tell Mousse which proxies to trust, with the `trustProxy` option of `new Mousse()`:

```ts
// Nginx on the same machine
new Mousse({ trustProxy: ['loopback'] });

// Load balancer in the private network
new Mousse({ trustProxy: ['private'] });

// Your own ranges, IPs or CIDR
new Mousse({ trustProxy: ['10.0.0.0/8', '203.0.113.7'] });

// Your own logic
new Mousse({ trustProxy: (ip) => myProxies.has(ip) });
```

| Value | Trusts |
|---|---|
| `['loopback']` | `127.0.0.0/8`, `::1` |
| `['private']` | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` |
| `['linklocal']` | `169.254.0.0/16`, `fe80::/10` |
| List of IPs or CIDR ranges | These addresses. Aliases can be mixed in |
| `(ip) => boolean` | What the function decides |
| `true` | Everything. **Do not use it with a rate limiter**, see below |

Mousse walks `x-forwarded-for` from the right, starting at the socket peer, for as long as the current address is trusted. `c.ip` is the first address that is not, which is the last one written by a proxy of yours:

```
x-forwarded-for: 6.6.6.6, 198.51.100.4, 10.0.0.2      socket peer: 10.0.0.1
                 forged   real client   your proxy                 your proxy

trustProxy: ['private']   ->   c.ip = 198.51.100.4
```

Each proxy must **append** to `x-forwarded-for`, not replace it with a client supplied value. With nginx:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### Forged addresses

A client can send any `x-forwarded-for` it likes. A limiter keyed on a forged address never rejects it, so:

- **Never use `trustProxy: true` with a rate limiter.** Every hop is trusted, so `c.ip` is the leftmost address of the header, the one the client wrote. Behind a real proxy too : the proxy only appends to it.
- **Keep the trusted list to your proxies.** `['private']` also trusts clients coming from your private network, who can then forge their address.
- **Do not let clients reach the server around the proxy** if the proxy's address is shared with them, or if the list is broad.

### Proxies that are not in a fixed range

Some CDNs have many public ranges, and put the client in their own header. Reading it from `keyGenerator` is only safe if **the server cannot be reached without going through this CDN** (firewall rules, private tunnel). Otherwise anybody can set this header:

```ts
new DefaultRateLimiter({
	keyGenerator: (c) => c.getHeader('cf-connecting-ip') ?? c.ip
});
```

### Check your setup

Before going to production, return `c.ip` from a temporary route and call it through the proxy:

```sh
curl https://example.com/whoami                                    # your public address, not the proxy's
curl -H 'x-forwarded-for: 6.6.6.6' https://example.com/whoami      # still your public address, not 6.6.6.6
```

The default key masks IPv6 addresses to their /64 (`ipv6Subnet`), so one IPv6 client does not get a new counter per address. Clients behind the same NAT share a public address and therefore a counter : for logged in users, prefer a [limit per user](#after-authentication).

## Options

| Option | Default | |
|---|---|---|
| `max` | `1000` | Requests allowed per client per window. Number, or `(c, key) => number`, sync or async |
| `timeWindow` | `60000` | Milliseconds or string (`'10s'`, `'1 minute'`, `'2 hours'`), or `(c, key) => milliseconds`, sync or async |
| `keyGenerator` | `c.ip` | `(c) => string`, sync or async. Identifies the client |
| `ipv6Subnet` | `64` | Prefix length of the default key : a client usually owns a whole /64 |
| `allowList` | | Keys never limited nor counted : an array, or `(c, key) => boolean`, sync or async |
| `ban` | `-1` | Requests answered `429` beyond `max` before the answer becomes `403`. `0` answers `403` right away, `-1` disables |
| `continueExceeding` | `false` | Requests over the limit restart the window : a client gets back in only once it stops |
| `exponentialBackoff` | `false` | Each request over the limit doubles the window. `continueExceeding` takes priority |
| `skipOnError` | `false` | A failing store lets requests through, without headers, instead of failing them with a 500 |
| `store` | `LocalRateLimitStore` | Where counters live, see [Stores](#stores) |
| `redis` | | Shorthand for `store: new RedisRateLimitStore(redis)` |
| `nameSpace` | `''` | Prefix telling apart limiters sharing a store |
| `cache` | `5000` | Maximum number of keys of the default `LocalRateLimitStore` |
| `enableDraftSpec` | `false` | `ratelimit-*` headers instead of `x-ratelimit-*` |
| `addHeadersOnExceeding` | all | Headers of requests under the limit : `{ 'x-ratelimit-reset': false }` |
| `addHeaders` | all | Headers of rejected requests : `{ 'retry-after': false }` |
| `errorResponseBuilder` | | `(c, context) => HTTPError`, see [Rejection](#rejection) |
| `onExceeding` | | `(c, key) => void`, on each request under the limit |
| `onExceeded` | | `(c, key) => void`, on each request over the limit |
| `onBanReach` | | `(c, key) => void`, on each banned request |

Invalid options (`max: -1`, `timeWindow: 'soon'`...) throw when the limiter is created.

### Headers

| Header | Value | When |
|---|---|---|
| `x-ratelimit-limit` | `max` | Always |
| `x-ratelimit-remaining` | Requests left in the window | Always |
| `x-ratelimit-reset` | Seconds until the window ends | Always |
| `retry-after` | Seconds until the window ends | Rejected requests |

## Rejection

Over the limit, the limiter throws a `RateLimitError`, an [`HTTPError`](routing.md#error-handling) : nothing else runs, and the answer is a `429` (`403` once banned) with `{ error: message }`.

A route `httpErrorHandler` takes over like for any other error:

```ts
import { Router, RateLimitError } from '@tyren/mousse';

const router = new Router({
	httpErrorHandler: { handle: (e, c) => {
		if (e instanceof RateLimitError)
			return c.status(e.statusCode).json({ code: 'SLOW_DOWN', retryIn: e.after, limit: e.max, ban: e.ban });
		c.status(500).respond();
	}}
});
```

To only change the status or the message, build the error yourself. `context` holds `statusCode`, `ban`, `max`, `ttl` (milliseconds) and `after` (`'1 minute'`):

```ts
import { DefaultRateLimiter, HTTPError } from '@tyren/mousse';

new DefaultRateLimiter({
	errorResponseBuilder: (c, { after }) => new HTTPError(429, `Too many attempts, try again in ${after}`)
});
```

## Stores

Windows are **fixed** : a window starts with the first request of a client and does not slide. Over a window boundary, a client can therefore send up to `2 × max` requests in a short time.

### LocalRateLimitStore

The default. Counters live in the process : with several instances or cluster workers, each one counts on its own, so the effective limit is multiplied by their number.

It keeps the `cache` most recently seen keys, a key pushed out starts over. Size it above the number of clients expected within a window : a flood of distinct addresses otherwise resets the counters of quieter clients.

### RedisRateLimitStore

Counters are shared by every instance. Works with [ioredis](https://github.com/redis/ioredis), which is not a dependency of Mousse:

```ts
import { Redis } from 'ioredis';
import { DefaultRateLimiter } from '@tyren/mousse';

// A request waits for Redis : keep these short so an outage does not hold requests
const redis = new Redis({ connectTimeout: 500, maxRetriesPerRequest: 1 });

const global = new DefaultRateLimiter({ redis, nameSpace: 'global-', max: 100, skipOnError: true });
const login = new DefaultRateLimiter({ redis, nameSpace: 'login-', max: 5 });
```

Limiters on the same store or client need **different `nameSpace`** so their counters stay apart. Creating a second one with the same name space throws. Keys in Redis are `mousse-rate-limit-<nameSpace><key>`, and expire with their window.

`skipOnError` is a trade-off : with it, a Redis outage disables rate limiting ; without it, a Redis outage answers 500 to every request going through the limiter.

### Custom store

A store implements one method, sync or async, which must count and report atomically:

```ts
import type { RateLimitStore } from '@tyren/mousse';

const store: RateLimitStore = {
	async incr(key, { timeWindow, max, continueExceeding, exponentialBackoff }) {
		// current : requests in the window, this one included. ttl : milliseconds left
		return { current, ttl };
	}
};
```

## Custom rate limiter

To use another algorithm (sliding window, token bucket...), implement the interface. Throw or answer through the context to reject the request:

```ts
import { HTTPError, type RateLimiter } from '@tyren/mousse';

const rateLimiter: RateLimiter = {
	async check(c) {
		if (!(await bucket.take(c.ip)))
			throw new HTTPError(429, 'Slow down');
	}
};

new Router({ rateLimiter });
```

## Coming from @fastify/rate-limit

Same options, headers, defaults and messages, except for the following:

| `@fastify/rate-limit` | Here |
|---|---|
| `global: true` + `config.rateLimit` on routes | `setDefaultRateLimiter()`, `new Router({ rateLimiter })` and the `rateLimiter` route option |
| `config.rateLimit: false` | `{ rateLimiter: false }` |
| `groupId` | Set the same instance on these routes |
| `hook` | Always before schemas. For later, call `check()` from a middleware |
| `store`: a class with `incr(key, callback, timeWindow, max)` and `child()` | `store`: an instance with `incr(key, options)` returning a promise or a value |
| `nameSpace` defaults to `fastify-rate-limit-` | Redis keys are prefixed with `mousse-rate-limit-`, `nameSpace` comes after |
| `createRateLimit()`, `fastify.rateLimit()` | Not provided : create a `DefaultRateLimiter` and call `check()` |
| Default `{statusCode, error, message}` body | `{error: message}`, like every Mousse `HTTPError` |
| `skipOnError` sends headers with a full `remaining` | No headers : nothing is known about the client |
| `LocalStore` resets after `timeWindow` even under `exponentialBackoff` | The backoff is enforced, like on Redis |

---

| [« Documentation generation](docgen.md) | [Documentation index](../README.md#documentation) | [README »](../README.md) |
|:---|:---:|---:|
