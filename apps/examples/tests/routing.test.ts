import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router, Mousse, testRouter } from '@tyren/mousse';

describe('routing', () => {
	test('route params, lowercased names', () => testRouter(
		new Router().get('/users/:id/books/:bookID', (c) => ({user : c.param('id'), book : c.param('bookid')})),
		async (client) => {
			const res = await client.get('/users/7/books/42');
			assert.deepEqual(await res.json(), {user : '7', book : '42'});
		}
	));

	test('wildcard routes', () => testRouter(
		new Router().get('/files/*', (c) => c.url),
		async (client) => {
			assert.equal(await (await client.get('/files/a/b.txt')).text(), '/files/a/b.txt');
		}
	));

	test('handler return values : string, object, undefined', () => testRouter(
		new Router()
			.get('/text', () => 'plain')
			.get('/json', () => ({ok : true}))
			.get('/empty', (c) => { c.status(204); }),
		async (client) => {
			assert.equal(await (await client.get('/text')).text(), 'plain');
			assert.deepEqual(await (await client.get('/json')).json(), {ok : true});
			assert.equal((await client.get('/empty')).status, 204);
		}
	));

	test('middlewares run in order before the handler', () => testRouter(
		new Router<any, {trace : string[]}>()
			.get('/traced',
				(c) => { c.trace = ['first']; },
				(c) => { c.trace.push('second'); },
				(c) => [...c.trace, 'handler']),
		async (client) => {
			assert.deepEqual(await (await client.get('/traced')).json(), ['first', 'second', 'handler']);
		}
	));

	test('scoped middleware matches segment boundaries only', async () => {
		const router = new Router<any, {seen? : boolean}>();
		router.use('/user', (c) => { c.seen = true; });
		router.get('/user/me', (c) => ({seen : c.seen ?? false}));
		router.get('/users', (c) => ({seen : c.seen ?? false}));

		await testRouter(router, async (client) => {
			assert.deepEqual(await (await client.get('/user/me')).json(), {seen : true});
			assert.deepEqual(await (await client.get('/users')).json(), {seen : false});
		});
	});

	test('mounted router routes are prefixed', async () => {
		const users = new Router().get('/:id', (c) => ({id : c.param('id')}));
		const app = new Router().use('/users', users);

		await testRouter(app, async (client) => {
			assert.deepEqual(await (await client.get('/users/1')).json(), {id : '1'});
		});
	});

	test('default handler catches unmatched routes', async () => {
		const app = new Mousse().get('/known', () => 'ok');
		app.setDefaultHandler({handle : (c) => c.status(404).respond('Nothing here')});

		await testRouter(app, async (client) => {
			const res = await client.get('/unknown');
			assert.equal(res.status, 404);
			assert.equal(await res.text(), 'Nothing here');
		});
	});
});

describe('error handling', () => {
	test('a throwing handler responds 500, never an implicit 200', () => testRouter(
		new Router().get('/boom', () => { throw new Error('boom'); }, ),
		async (client) => {
			assert.equal((await client.get('/boom')).status, 500);
		}
	));

	test('httpErrorHandler may respond itself', () => testRouter(
		new Router().get('/teapot', {
			httpErrorHandler : {handle : (error, c) => c.status(418).respond(error.message)}
		}, () => { throw new Error('short and stout'); }),
		async (client) => {
			const res = await client.get('/teapot');
			assert.equal(res.status, 418);
			assert.equal(await res.text(), 'short and stout');
		}
	));

	test('router-level httpErrorHandler applies to its routes, route option wins', async () => {
		const router = new Router({httpErrorHandler : {handle : (_e, c) => c.status(502).respond()}});
		router.get('/inherit', () => { throw new Error(); });
		router.get('/own', {httpErrorHandler : {handle : (_e, c) => c.status(503).respond()}}, () => { throw new Error(); });

		await testRouter(router, async (client) => {
			assert.equal((await client.get('/inherit')).status, 502);
			assert.equal((await client.get('/own')).status, 503);
		});
	});
});
