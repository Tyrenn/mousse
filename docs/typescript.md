[« Documentation index](../README.md#documentation)

# Typescript

Mousse is fully typed. Two generic slots drive the typing of a route: the **context types** (what flows through the request/response) and the **context extension** (extra members middlewares attach to the context).

```ts
app.METHOD<ContextTypes, ContextExtension>(pattern, ...handlers);
```

## Context Types

`ContextTypes` describes the shapes bound to a route:

```ts
type ContextTypes = {
	Body?: any;       // Type returned by c.body()
	Response?: any;   // Type accepted by c.json() and handler returns
	Query?: any;      // Type of c.query
	Params?: string;  // Union of the route parameter names
}
```

When a route declares [schemas](schemas.md), all of this is **inferred automatically** — explicit generics are only needed on schema-less routes:

```ts
type CreateUser = {
	Body: { name: string; email: string };
	Response: { id: number };
	Params: 'org';
};

app.post<CreateUser>('/orgs/:org/users', async (c) => {
	const body = await c.body();   // { name: string; email: string }
	c.param('org');                // OK
	c.param('nope');               // Type error
	return { id: 1 };              // Must match Response
});
```

Handlers are also constrained per method: for example `c.body` is not available on `get`/`head`/`options` handlers, and only sustainable methods expose `c.sustain()`.

## Extending the Context

Middlewares often attach data to the context (a user, a session...). Declare the extension in the second generic slot and every function of the route sees it:

```ts
type Auth = {
	user: { id: number; name: string };
};

app.get<any, Auth>('/me',
	(c) => {
		c.user = lookupUser(c.getHeader('authorization'));
	},
	(c) => {
		return c.user; // typed, no cast needed
	});
```

An extension can also be declared router-wide, so every route registered on it is typed with the extension by default:

```ts
const router = new Router<any, Auth>();

router.get('/profile', (c) => c.user);
```

> Note: `use()` currently returns the router unchanged (`this`) for chaining; it does not propagate a new extension type to the returned value. Declare extensions on the router generics or per-route.

---

| [« Modules](modules.md) | [Documentation index](../README.md#documentation) | [Schemas »](schemas.md) |
|:---|:---:|---:|
