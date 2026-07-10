import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router, testRouter } from 'mousse';

describe('request', () => {
	test('headers are exposed with lowercased keys', () => testRouter(
		new Router().get('/headers', (c) => ({auth : c.getHeader('authorization'), missing : c.getHeader('x-missing')})),
		async (client) => {
			const res = await client.get('/headers', {headers : {Authorization : 'Bearer token'}});
			assert.deepEqual(await res.json(), {auth : 'Bearer token', missing : null});
		}
	));

	test('query string parsing : arrays, +, [] stripped', () => testRouter(
		new Router().get('/q', (c) => c.query),
		async (client) => {
			const res = await client.get('/q?a=1&tags[]=x&tags[]=y&msg=hello+world');
			assert.deepEqual(await res.json(), {a : '1', tags : ['x', 'y'], msg : 'hello world'});
		}
	));

	test('json body is parsed and cached', () => testRouter(
		new Router().post('/echo', async (c) => {
			const first = await c.body();
			const second = await c.body();
			return {same : first === second, body : first};
		}),
		async (client) => {
			const res = await client.post('/echo', {name : 'mousse'});
			assert.deepEqual(await res.json(), {same : true, body : {name : 'mousse'}});
		}
	));

	test('body stays readable after other async work', () => testRouter(
		new Router().post('/late', async (c) => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return await c.body();
		}),
		async (client) => {
			assert.deepEqual(await (await client.post('/late', {late : true})).json(), {late : true});
		}
	));

	test('urlencoded body parsed to a record', () => testRouter(
		new Router().post('/form', async (c) => await c.body()),
		async (client) => {
			const res = await client.post('/form', new URLSearchParams({a : '1', b : 'two'}));
			assert.deepEqual(await res.json(), {a : '1', b : 'two'});
		}
	));

	test('method and route pattern are exposed', () => testRouter(
		new Router().get('/users/:id', (c) => ({method : c.method(), route : c.route, url : c.url})),
		async (client) => {
			assert.deepEqual(await (await client.get('/users/5')).json(), {method : 'get', route : '/users/:id', url : '/users/5'});
		}
	));
});

describe('response', () => {
	test('status, headers and json chain', () => testRouter(
		new Router().get('/chained', (c) => c.status(201).header('x-request-id', 'abc').json({ok : true})),
		async (client) => {
			const res = await client.get('/chained');
			assert.equal(res.status, 201);
			assert.equal(res.headers.get('x-request-id'), 'abc');
			assert.deepEqual(await res.json(), {ok : true});
		}
	));

	test('html responds with text/html', () => testRouter(
		new Router().get('/page', (c) => c.html('<h1>Hi</h1>')),
		async (client) => {
			const res = await client.get('/page');
			assert.ok(res.headers.get('content-type')?.includes('text/html'));
			assert.equal(await res.text(), '<h1>Hi</h1>');
		}
	));

	test('redirect responds 302 with location', () => testRouter(
		new Router().get('/old', (c) => c.redirect('/new')),
		async (client) => {
			const res = await client.get('/old', {redirect : 'manual'});
			assert.equal(res.status, 302);
			assert.equal(res.headers.get('location'), '/new');
		}
	));

	test('responding twice is a no-op, never an error', () => testRouter(
		new Router().get('/twice', (c) => {
			c.respond('first');
			c.respond('second');
			return 'third';
		}),
		async (client) => {
			assert.equal(await (await client.get('/twice')).text(), 'first');
		}
	));
});
