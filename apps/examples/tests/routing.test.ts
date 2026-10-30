import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router, Mousse, testRouter, HTTPError } from '@tyren/mousse';
import { z } from 'zod';

describe('request hooks', () => {
	test('run first : router hooks, route hooks, then middlewares and the handler', async () => {
		const ran : string[] = [];
		const track = (name : string) => () => { ran.push(name); };
		const router = new Router()
			.use(track('middleware'))
			.onRequest(track('router hook'))
			.onRequest(async () => { ran.push('async router hook'); })
			.get('/a', {onRequest : track('route hook')}, () => { ran.push('handler'); return 'ok'; })
			.get('/b', {onRequest : [track('first'), track('second')]}, () => 'ok');

		await testRouter(router, async (client) => {
			await client.get('/a');
			assert.deepEqual(ran, ['router hook', 'async router hook', 'route hook', 'middleware', 'handler']);

			ran.length = 0;
			await client.get('/b');
			assert.deepEqual(ran, ['router hook', 'async router hook', 'first', 'second', 'middleware']);
		});
	});

	test('run before schemas : values are raw, and invalid requests reach them', async () => {
		const seen : unknown[] = [];
		const router = new Router().get('/users/:id', {
			schemas : {Params : z.object({id : z.coerce.number()}), Query : z.object({page : z.coerce.number()})},
			onRequest : (c) => { seen.push(c.param('id'), c.query.page); }
		}, () => 'ok');

		await testRouter(router, async (client) => {
			assert.equal((await client.get('/users/1?page=2')).status, 200);
			assert.equal((await client.get('/users/abc?page=2')).status, 400);
		});

		assert.deepEqual(seen, ['1', '2', 'abc', '2']);
	});

	test('run before the body limit', async () => {
		let hook = 0;
		const router = new Router().post('/a', {bodyLimit : 10, onRequest : () => { hook++; }}, () => 'ok');

		await testRouter(router, async (client) => {
			assert.equal((await client.post('/a', 'a'.repeat(100))).status, 413);
		});

		assert.equal(hook, 1);
	});

	test('answering ends the request', async () => {
		const ran : string[] = [];
		const router = new Router()
			.onRequest((c) => c.status(401).respond('no'))
			.onRequest(() => { ran.push('next hook'); })
			.use(() => { ran.push('middleware'); })
			.get('/a', () => { ran.push('handler'); return 'ok'; });

		await testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.status, 401);
			assert.equal(await res.text(), 'no');
		});

		assert.deepEqual(ran, []);
	});

	test('throwing ends the request through the error handling', async () => {
		let handler = 0;
		const router = new Router()
			.get('/a', {onRequest : () => { throw new HTTPError(403, 'Blocked'); }}, () => { handler++; return 'ok'; })
			.get('/b', {
				onRequest : () => { throw new Error('boom'); },
				httpErrorHandler : {handle : (e, c) => c.status(418).respond(e.message)}
			}, () => { handler++; return 'ok'; });

		await testRouter(router, async (client) => {
			const blocked = await client.get('/a');
			assert.equal(blocked.status, 403);
			assert.deepEqual(await blocked.json(), {error : 'Blocked'});

			assert.equal((await client.get('/b')).status, 418);
		});

		assert.equal(handler, 0);
	});

	test('scoped by pattern, and follow a mounted router', async () => {
		const ran : string[] = [];
		const inner = new Router()
			.onRequest(() => { ran.push('inner'); })
			.get('/a', () => 'ok');
		const router = new Router()
			.onRequest('/admin', () => { ran.push('admin'); })
			.use('/v1', inner)
			.get('/admin/a', () => 'ok')
			.get('/administrator', () => 'ok');

		await testRouter(router, async (client) => {
			await client.get('/v1/a');
			assert.deepEqual(ran, ['inner']);

			ran.length = 0;
			await client.get('/admin/a');
			assert.deepEqual(ran, ['admin']);

			ran.length = 0;
			await client.get('/administrator');
			assert.deepEqual(ran, []);
		});
	});
});

describe('routing', () => {
	test('route params keep their declared case', () => testRouter(
		new Router().get('/users/:id/books/:bookID', (c) => ({user : c.param('id'), book : c.param('bookID'), params : c.params})),
		async (client) => {
			const res = await client.get('/users/7/books/42');
			assert.deepEqual(await res.json(), {user : '7', book : '42', params : {id : '7', bookID : '42'}});
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
	test('a middleware answering stops the request', async () => {
		const ran : string[] = [];
		const router = new Router()
			.use('/router', (c) => { c.status(401).respond('no'); })
			.use('/router', () => { ran.push('next router middleware'); })
			.del('/router/x', () => { ran.push('router handler'); return 'ok'; })
			.del('/route/x', (c) => { c.status(403).respond('no'); }, () => { ran.push('next route middleware'); }, () => { ran.push('route handler'); return 'ok'; });

		await testRouter(router, async (client) => {
			assert.equal((await client.del('/router/x')).status, 401);
			assert.equal((await client.del('/route/x')).status, 403);
		});

		assert.deepEqual(ran, []);
	});

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
