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

	test('body validation is lazy : handler never reading the body never fails', () => testRouter(
		new Router().post('/lazy', {
			schemas : {Body : z.object({strict : z.string()})}
		}, () => 'never read the body'),
		async (client) => {
			const res = await client.post('/lazy', {strict : 42});
			assert.equal(res.status, 200);
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
