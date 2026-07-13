import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { testRouter } from '@tyren/mousse';

import { app as asyncFunction } from '../src/asyncFunction.ts';
import { app as contextExtension } from '../src/contextExtension.ts';
import { app as schemas } from '../src/schemas.ts';
import { app as routers } from '../src/routers.ts';
import { app as sse } from '../src/sse.ts';
import { app as docgen } from '../src/docgen.ts';

/**
 * Examples are executable documentation : each one exports its app,
 * so RouteTester can verify they keep working against the current package.
 */
describe('examples smoke tests', () => {
	test('asyncFunction responds after awaiting', () => testRouter(asyncFunction, async (client) => {
		assert.equal(await (await client.get('/anything')).text(), 'Hey wait for me!');
	}));

	test('contextExtension middleware extends the context', () => testRouter(contextExtension, async (client) => {
		assert.deepEqual(await (await client.post('/', 'test')).json(), {prop : true, greeting : 'Hello'});
	}));

	test('schemas validates and types the request', () => testRouter(schemas, async (client) => {
		const created = await client.post('/orgs/acme/users', {name : '  Ada  ', email : 'ada@lovelace.dev'});
		assert.deepEqual(await created.json(), {id : 1, org : 'acme', name : 'Ada'});

		assert.equal((await client.post('/orgs/acme/users', {name : 42})).status, 400);

		const custom = await client.post('/strict', {value : 'not-a-number'});
		assert.equal(custom.status, 422);
		assert.equal((await custom.json()).part, 'body');
	}));

	test('routers composition, defaults and scoped middleware', () => testRouter(routers, async (client) => {
		assert.deepEqual(await (await client.get('/users')).json(), [{id : 1}, {id : 2}]);
		assert.deepEqual(await (await client.get('/users/7')).json(), {id : '7'});

		assert.equal((await client.del('/admin/users/7')).status, 401);
		const authorized = await client.del('/admin/users/7', undefined, {headers : {authorization : 'yes'}});
		assert.deepEqual(await authorized.json(), {deleted : '7'});

		assert.equal((await client.get('/nowhere')).status, 404);
	}));

	test('sse streams its welcome frame', () => testRouter(sse, async (client) => {
		const res = await client.get('/clock');
		const reader = res.body!.getReader();
		const {value} = await reader.read();
		assert.ok(new TextDecoder().decode(value).includes('welcome'));
		await reader.cancel();
	}));

	test('docgen routes respond, registry is set up', () => testRouter(docgen, async (client) => {
		assert.deepEqual(await (await client.get('/users/1')).json(), {id : '1', name : 'Guillaume'});
	}));
});
