import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Mousse, Router, testRouter, HTTPError, PayloadTooLargeError, type MousseOptions } from '@tyren/mousse';

// Some options live on Mousse itself (trustProxy) : testRouter mounts on a default instance
async function withApp(options : MousseOptions, setup : (app : Mousse) => void, callback : (base : string) => Promise<void>){
	const app = new Mousse(options);
	setup(app);
	const port = await new Promise<number>((resolve, reject) => app.listen(0, (ls, port) => ls ? resolve(port) : reject(new Error('listen failed'))));
	try{
		await callback(`http://127.0.0.1:${port}`);
	} finally {
		app.stop();
	}
}

function chunkedBody(chunks : number, size : number){
	let sent = 0;
	return new ReadableStream({
		pull(controller){
			if(sent++ < chunks)
				controller.enqueue(new Uint8Array(size).fill(97));
			else
				controller.close();
		}
	});
}

describe('bodyLimit', () => {
	const router = new Router({bodyLimit : 1024})
		.post('/echo', async (c) => ({size : (await c.body(true))?.length}))
		.post('/ignore', () => ({ignored : true}))
		.post('/big', {bodyLimit : 4096}, async (c) => ({size : (await c.body(true))?.length}));

	test('body under the limit is accepted', () => testRouter(router, async (client) => {
		assert.deepEqual(await (await client.post('/echo', 'a'.repeat(1000))).json(), {size : 1000});
	}));

	test('declared content-length over the limit -> 413 before the handler', () => testRouter(router, async (client) => {
		const res = await client.post('/ignore', 'a'.repeat(2000));
		assert.equal(res.status, 413);
		assert.deepEqual(await res.json(), {error : 'Payload too large'});
	}));

	test('chunked body over the limit -> 413 when read', () => testRouter(router, async (client) => {
		const res = await client.post('/echo', undefined, {body : chunkedBody(10, 512), duplex : 'half'} as RequestInit);
		assert.equal(res.status, 413);
	}));

	test('route option overrides the router one', () => testRouter(router, async (client) => {
		assert.deepEqual(await (await client.post('/big', 'a'.repeat(3000))).json(), {size : 3000});
	}));

	test('default limit is 1 MiB', () => testRouter(
		new Router().post('/echo', async (c) => ({size : (await c.body(true))?.length})),
		async (client) => {
			assert.equal((await client.post('/echo', 'a'.repeat(1024 * 1024))).status, 200);
			assert.equal((await client.post('/echo', 'a'.repeat(1024 * 1024 + 1))).status, 413);
		}
	));

	test('httpErrorHandler receives the PayloadTooLargeError', () => testRouter(
		new Router({bodyLimit : 10, httpErrorHandler : {handle : (e, c) => c.status(e instanceof PayloadTooLargeError ? 499 : 500).respond(String(e.limit))}})
			.post('/echo', async (c) => await c.body()),
		async (client) => {
			const res = await client.post('/echo', 'a'.repeat(100));
			assert.equal(res.status, 499);
			assert.equal(await res.text(), '10');
		}
	));
});

describe('HTTPError', () => {
	test('thrown HTTPError answers its status', () => testRouter(
		new Router().get('/missing', () => { throw new HTTPError(404, 'No such offer'); }),
		async (client) => {
			const res = await client.get('/missing');
			assert.equal(res.status, 404);
			assert.deepEqual(await res.json(), {error : 'No such offer'});
		}
	));
});

describe('client ip and trusted proxies', () => {
	const setup = (app : Mousse) => app.get('/ip', (c) => ({ip : c.ip, ips : c.ips, protocol : c.protocol, host : c.host}));
	const forwarded = {headers : {'x-forwarded-for' : '1.1.1.1, 2.2.2.2, 10.0.0.5', 'x-forwarded-proto' : 'https', 'x-forwarded-host' : 'api.example.com'}};

	test('without trustProxy, forwarded headers are ignored', () => withApp({}, setup, async (base) => {
		const res = await (await fetch(`${base}/ip`, forwarded)).json();
		assert.equal(res.ip, '127.0.0.1');
		assert.deepEqual(res.ips, ['127.0.0.1']);
		assert.equal(res.protocol, 'http');
		assert.match(res.host, /^127\.0\.0\.1:\d+$/);
	}));

	test('x-forwarded-for is walked from the right, stopping at the first untrusted hop', () => withApp({trustProxy : ['loopback', '10.0.0.0/8']}, setup, async (base) => {
		const res = await (await fetch(`${base}/ip`, forwarded)).json();
		assert.equal(res.ip, '2.2.2.2');
		assert.deepEqual(res.ips, ['2.2.2.2', '10.0.0.5', '127.0.0.1']);
		assert.equal(res.protocol, 'https');
		assert.equal(res.host, 'api.example.com');
	}));

	test('trustProxy true takes the leftmost hop', () => withApp({trustProxy : true}, setup, async (base) => {
		assert.equal((await (await fetch(`${base}/ip`, forwarded)).json()).ip, '1.1.1.1');
	}));

	test('ip stays the socket address when the peer is not trusted', () => withApp({trustProxy : ['10.0.0.0/8']}, setup, async (base) => {
		const res = await (await fetch(`${base}/ip`, forwarded)).json();
		assert.equal(res.ip, '127.0.0.1');
		assert.equal(res.protocol, 'http');
	}));
});

describe('onResponse', () => {
	test('reports route, status and elapsed time, errors included', async () => {
		const seen : {route : string, statusCode : number, elapsedTime : number, aborted : boolean}[] = [];
		await testRouter(
			new Router()
				.onResponse((c, info) => { seen.push({route : c.route, ...info}); })
				.get('/users/:id', (c) => c.status(201).json({id : c.param('id')}))
				.get('/boom', () => { throw new Error('boom'); }),
			async (client) => {
				await (await client.get('/users/1')).text();
				await (await client.get('/boom')).text();
			}
		);
		assert.deepEqual(seen.map(({route, statusCode, aborted}) => ({route, statusCode, aborted})), [
			{route : '/users/:id', statusCode : 201, aborted : false},
			{route : '/boom', statusCode : 500, aborted : false}
		]);
		assert.ok(seen.every(info => info.elapsedTime > 0));
	});

	test('hooks are scoped by pattern, including mounted routers', async () => {
		const seen : string[] = [];
		const api = new Router()
			.onResponse('/admin', (c) => { seen.push(`admin:${c.url}`); })
			.get('/admin/stats', () => 'stats')
			.get('/public', () => 'public');
		await testRouter(new Router().use('/api', api), async (client) => {
			await (await client.get('/api/admin/stats')).text();
			await (await client.get('/api/public')).text();
		});
		assert.deepEqual(seen, ['admin:/api/admin/stats']);
	});

	test('aborted requests are reported', async () => {
		let resolveHook! : (aborted : boolean) => void;
		const hooked = new Promise<boolean>((resolve) => resolveHook = resolve);
		await testRouter(
			new Router()
				.onResponse((c, info) => resolveHook(info.aborted))
				.get('/slow', async () => { await new Promise((r) => setTimeout(r, 500)); return 'late'; }),
			async (client) => {
				const controller = new AbortController();
				setTimeout(() => controller.abort(), 50);
				await client.get('/slow', {signal : controller.signal}).catch(() => {});
				assert.equal(await hooked, true);
			}
		);
	});

	test('a throwing hook never breaks the response', () => testRouter(
		new Router()
			.onResponse(() => { throw new Error('hook failure'); })
			.onResponse(async () => { throw new Error('async hook failure'); })
			.get('/ok', () => 'ok'),
		async (client) => {
			assert.equal(await (await client.get('/ok')).text(), 'ok');
		}
	));
});
