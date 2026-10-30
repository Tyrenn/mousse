import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router, testRouter, SchemaValidationError } from '@tyren/mousse';
import { z } from 'zod';

describe('schema validation', () => {
	test('valid request passes, schema output transformations applied', () => testRouter(
		new Router().post('/users', {
			schemas : {
				Body : z.object({name : z.string().trim(), age : z.number()}),
				Response : z.object({created : z.boolean()})
			}
		}, async (c) => {
			const body = await c.body();
			assert.equal(body.name, 'Guillaume'); // trimmed by the schema
			return {created : true};
		}),
		async (client) => {
			const res = await client.post('/users', {name : '  Guillaume  ', age : 30});
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), {created : true});
		}
	));

	test('invalid body responds 400 with issues', () => testRouter(
		new Router().post('/users', {
			schemas : {Body : z.object({name : z.string()})}
		}, async (c) => await c.body()),
		async (client) => {
			const res = await client.post('/users', {name : 42});
			assert.equal(res.status, 400);
			const payload = await res.json();
			assert.ok(Array.isArray(payload.issues));
		}
	));

	test('invalid query responds 400 before the handler runs', async () => {
		let handlerRan = false;
		const router = new Router().get('/search', {
			schemas : {Query : z.object({limit : z.coerce.number().max(10)})}
		}, (c) => { handlerRan = true; return c.query; });

		await testRouter(router, async (client) => {
			assert.equal((await client.get('/search?limit=100')).status, 400);
			assert.equal(handlerRan, false);
		});
	});

	test('query coercion feeds the handler with schema output', () => testRouter(
		new Router().get('/search', {
			schemas : {Query : z.object({limit : z.coerce.number()})}
		}, (c) => ({limit : c.query.limit, type : typeof c.query.limit})),
		async (client) => {
			assert.deepEqual(await (await client.get('/search?limit=5')).json(), {limit : 5, type : 'number'});
		}
	));

	test('invalid params respond 400', () => testRouter(
		new Router().get('/orgs/:org', {
			schemas : {Params : z.object({org : z.string().regex(/^[a-z]+$/)})}
		}, (c) => c.param('org')),
		async (client) => {
			assert.equal((await client.get('/orgs/valid')).status, 200);
			assert.equal((await client.get('/orgs/INVALID42')).status, 400);
		}
	));

	test('invalid response is a 500 server bug', () => testRouter(
		new Router().get('/broken', {
			schemas : {Response : z.object({id : z.number()})}
		}, (c) => { c.json({id : 'not-a-number'} as any); }),
		async (client) => {
			assert.equal((await client.get('/broken')).status, 500);
		}
	));

	test('body is validated before the handler, even when it never reads it', () => testRouter(
		new Router().post('/eager', {
			schemas : {Body : z.object({strict : z.string()})}
		}, () => 'never read the body'),
		async (client) => {
			const res = await client.post('/eager', {strict : 42});
			assert.equal(res.status, 400);
		}
	));

	test('middlewares run before body validation', async () => {
		let parsedBeforeAuth = false;
		await testRouter(
			new Router().post('/secured', {
				schemas : {Body : z.object({name : z.string().refine(() => { parsedBeforeAuth = true; return true; })})}
			}, (c) => c.getHeader('authorization') ? undefined : c.status(401).respond(), (c) => 'ok'),
			async (client) => {
				assert.equal((await client.post('/secured', {name : 'x'})).status, 401);
				assert.equal(parsedBeforeAuth, false);
				assert.equal((await client.post('/secured', {name : 'x'}, {headers : {authorization : 'yes'}})).status, 200);
				assert.equal(parsedBeforeAuth, true);
			}
		);
	});

	test('malformed json is a 400, not a 500', () => testRouter(
		new Router()
			.post('/plain', async (c) => await c.body())
			.post('/schema', {schemas : {Body : z.object({a : z.string()})}}, async (c) => await c.body()),
		async (client) => {
			for(const path of ['/plain', '/schema']){
				const res = await client.post(path, '{"a":', {headers : {'content-type' : 'application/json'}});
				assert.equal(res.status, 400);
				assert.deepEqual(await res.json(), {error : 'Malformed body'});
			}
		}
	));

	test('validationErrorStatus changes the invalid request status', () => testRouter(
		new Router({validationErrorStatus : 422}).post('/users', {
			schemas : {Body : z.object({name : z.string()})}
		}, async (c) => await c.body()),
		async (client) => {
			assert.equal((await client.post('/users', {name : 42})).status, 422);
		}
	));

	test('custom httpErrorHandler receives SchemaValidationError with part', () => testRouter(
		new Router().post('/custom', {
			schemas : {Body : z.object({name : z.string()})},
			httpErrorHandler : {
				handle : (error, c) => {
					if(error instanceof SchemaValidationError)
						return c.status(422).json({part : error.part});
					c.status(500).respond();
				}
			}
		}, async (c) => await c.body()),
		async (client) => {
			const res = await client.post('/custom', {name : 1});
			assert.equal(res.status, 422);
			assert.deepEqual(await res.json(), {part : 'body'});
		}
	));

	test('route without schemas validates nothing', () => testRouter(
		new Router().post('/free', async (c) => await c.body()),
		async (client) => {
			assert.deepEqual(await (await client.post('/free', {anything : ['goes']})).json(), {anything : ['goes']});
		}
	));
});

describe('response schemas per status', () => {
	const router = new Router().get('/offers/:idOffer', {
		schemas : {
			Response : {
				200 : z.object({id : z.string()}),
				201 : z.object({id : z.string(), created : z.literal(true)}),
				'4xx' : z.object({error : z.string()})
			}
		}
	}, (c) => {
		const id = c.param('idOffer')!;
		if(id === 'missing')
			return c.status(404).json({error : 'Offer not found'});
		if(id === 'bad-error')
			return c.status(404).json({nope : true} as any);
		if(id === 'new')
			return c.status(201).json({id, created : true});
		if(id === 'teapot')
			return c.status(503).json({anything : 'goes'} as any);
		return {id};
	});

	test('exact code, then range, picks the schema', () => testRouter(router, async (client) => {
		assert.deepEqual(await (await client.get('/offers/1')).json(), {id : '1'});
		assert.deepEqual(await (await client.get('/offers/new')).json(), {id : 'new', created : true});

		const missing = await client.get('/offers/missing');
		assert.equal(missing.status, 404);
		assert.deepEqual(await missing.json(), {error : 'Offer not found'});

		assert.equal((await client.get('/offers/bad-error')).status, 500);
	}));

	test('a status without schema is not validated', () => testRouter(router, async (client) => {
		const res = await client.get('/offers/teapot');
		assert.equal(res.status, 503);
		assert.deepEqual(await res.json(), {anything : 'goes'});
	}));

	test('a single Response schema only covers 2xx', () => testRouter(
		new Router().get('/one', {schemas : {Response : z.object({id : z.number()})}}, (c) => c.status(404).json({error : 'nope'} as any)),
		async (client) => {
			const res = await client.get('/one');
			assert.equal(res.status, 404);
			assert.deepEqual(await res.json(), {error : 'nope'});
		}
	));

	test('undeclared keys are stripped by zod response schemas', () => testRouter(
		new Router().get('/me', {schemas : {Response : z.object({id : z.string()})}}, () => ({id : '1', passwordHash : 'secret'} as any)),
		async (client) => {
			assert.deepEqual(await (await client.get('/me')).json(), {id : '1'});
		}
	));
});

describe('compiled serializers', () => {
	test('compile runs once per schema at registration and replaces serialize', async () => {
		const compiled : string[] = [];
		let serializeCalls = 0;
		const ok = z.object({id : z.string()});
		const err = z.object({error : z.string()});
		const serializer = {
			serialize : (res : any) => { serializeCalls++; return JSON.stringify(res); },
			compile : (schema : any) => {
				const name = schema === ok ? 'ok' : 'err';
				compiled.push(name);
				return (res : any) => JSON.stringify({...res, via : name});
			}
		};

		await testRouter(
			new Router({responseSerializer : serializer}).get('/x/:id', {schemas : {Response : {200 : ok, '4xx' : err}}}, (c) =>
				c.param('id') === 'none' ? c.status(404).json({error : 'none'}) : ({id : c.param('id')!})
			),
			async (client) => {
				assert.deepEqual(await (await client.get('/x/1')).json(), {id : '1', via : 'ok'});
				assert.deepEqual(await (await client.get('/x/2')).json(), {id : '2', via : 'ok'});
				assert.deepEqual(await (await client.get('/x/none')).json(), {error : 'none', via : 'err'});
			}
		);

		assert.deepEqual(compiled.sort(), ['err', 'ok']);
		assert.equal(serializeCalls, 0);
	});
});

// Type level checks, enforced by check-types
new Router().get('/typed', {
	schemas : {Response : {200 : z.object({id : z.string()}), 404 : z.object({error : z.string()})}}
}, (c) => {
	if(Math.random() > 2)
		return c.status(404).json({error : 'x'});
	// @ts-expect-error neither the 200 nor the 404 shape
	c.json({other : 1});
	return {id : 'ok'};
});
