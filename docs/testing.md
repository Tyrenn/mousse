# Testing routes

Mousse can fire real HTTP requests against a router or app without binding a real port : `RouteTester` spins up a single ephemeral instance (`listen(0)`, OS-assigned port) and lets you send requests through it, then closes it.

```ts
import { Router } from 'mousse';

const users = new Router()
	.get('/users/:id', (c) => ({ id: c.param('id') }))
	.post('/users', async (c) => ({ created: await c.body() }));

const client = users.test();

const res = await client.get('/users/42');
await res.json(); // { id: '42' }

const created = await client.post('/users', { name: 'Guillaume' });
await created.json(); // { created: { name: 'Guillaume' } }

await client.close();
```

`client.get`/`post`/`put`/`patch`/`del`/`head`/`options` return the native `fetch` [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) — no custom assertion API to learn, use it with whatever test runner you like (`node:test`, vitest, jest...).

## One instance per test, not per route

Testing a whole router means firing several requests through the **same** `RouteTester` — calling `router.test()` once and reusing the returned client is what keeps it to a single ephemeral instance, no matter how many routes you exercise :

```ts
const client = router.test();

await client.get('/users');
await client.get('/users/1');
await client.post('/users', {...});
await client.del('/users/1');

await client.close(); // one instance, closed once
```

Calling `router.test()` again creates a **new** independent ephemeral instance on a different port — useful for isolating unrelated test files, but avoid calling it more than once per test suite/file if you're testing many routes of the same router.

## `testRouter` : auto-closing helper

`testRouter(router, callback)` creates the client, runs `callback`, and closes the instance afterwards — even if the callback throws. Convenient inside a single test case :

```ts
import { testRouter } from 'mousse';

test('users routes', () => testRouter(users, async (client) => {
	const res = await client.get('/users/42');
	assert.equal(res.status, 200);
}));
```

## Request bodies

Passing a plain object as the body auto-serializes it as JSON and sets `content-type` :

```ts
await client.post('/users', { name: 'Guillaume' });
```

Pass a `string`, `Buffer`, `FormData` or `URLSearchParams` to send it as-is (no JSON encoding) :

```ts
await client.post('/upload', new FormData());
```

The last argument of any verb method is a standard [`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) for full control (custom headers, signal...) :

```ts
await client.get('/users/42', { headers: { authorization: 'Bearer token' } });
```

## Testing a Mousse app directly

`test()` and `testRouter()` work the same way on a full `Mousse` instance — its routes, middlewares and default handler are all mounted into the ephemeral instance, the real app is never touched (never listens on a real port during the test) :

```ts
const client = app.test();
```

## What isn't covered

`RouteTester` drives plain HTTP requests — this already covers [Server-Sent Events](server-sent-events.md) naturally, since a `get()` response is a regular streamable `Response`. WebSocket upgrades are not covered yet : testing a `ws()` route today still requires a real listening instance and a `WebSocket` client, as in [WebSockets](websockets.md).
