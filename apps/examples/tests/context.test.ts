import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Router, testRouter } from '@tyren/mousse';

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

	test('multi-valued headers are written as separate lines', () => testRouter(
		new Router().get('/cookies', (c) => {
			c.header('set-cookie', ['a=1; Path=/', 'b=2; Path=/']);
			c.appendHeader('Set-Cookie', 'c=3; Path=/');
			c.appendHeader('x-single', 'one');
			return 'ok';
		}),
		async (client) => {
			const res = await client.get('/cookies');
			assert.deepEqual(res.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/', 'c=3; Path=/']);
			assert.equal(res.headers.get('x-single'), 'one');
		}
	));

	test('custom status message', () => testRouter(
		new Router().get('/teapot', (c) => c.status(418, 'Short and stout').respond()),
		async (client) => {
			const res = await client.get('/teapot');
			assert.equal(res.status, 418);
			assert.equal(res.statusText, 'Short and stout');
		}
	));
});

describe('delete body', () => {
	test('DELETE body is readable', () => testRouter(
		new Router().del('/items', async (c) => await c.body()),
		async (client) => {
			assert.deepEqual(await (await client.del('/items', {ids : [1, 2]})).json(), {ids : [1, 2]});
		}
	));
});

describe('file', () => {
	const dir = mkdtempSync(join(tmpdir(), 'mousse-file-'));
	// Several MB so the socket backpressures and the stream has to pause / resume
	const big = randomBytes(8 * 1024 * 1024);
	writeFileSync(join(dir, 'big.bin'), big);
	writeFileSync(join(dir, 'page.html'), '<h1>file</h1>');
	writeFileSync(join(dir, 'empty.txt'), '');
	after(() => rmSync(dir, {recursive : true, force : true}));

	const router = new Router().get('/files/*', (c) => c.file(join(dir, c.url.slice('/files/'.length))));

	test('streams a large file intact', () => testRouter(router, async (client) => {
		const res = await client.get('/files/big.bin');
		assert.equal(res.status, 200);
		assert.equal(res.headers.get('content-length'), String(big.length));
		assert.ok(Buffer.from(await res.arrayBuffer()).equals(big));
	}));

	test('sets content type from extension', () => testRouter(router, async (client) => {
		const res = await client.get('/files/page.html');
		assert.ok(res.headers.get('content-type')?.includes('text/html'));
		assert.equal(await res.text(), '<h1>file</h1>');
	}));

	// Forward slashes on purpose : windows paths don't contain any, which used to hide the path in the header
	test('content type never exposes the file path', () => testRouter(
		new Router().get('/page', (c) => c.file(`${dir}/page.html`)),
		async (client) => {
			const res = await client.get('/page');
			assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
			await res.text();
		}
	));

	test('empty file', () => testRouter(router, async (client) => {
		const res = await client.get('/files/empty.txt');
		assert.equal(res.status, 200);
		assert.equal(await res.text(), '');
	}));

	test('client aborting mid-stream leaves the server healthy', () => testRouter(router, async (client) => {
		const controller = new AbortController();
		const res = await client.get('/files/big.bin', {signal : controller.signal});
		const reader = res.body!.getReader();
		await reader.read();
		controller.abort();
		await reader.read().catch(() => {});

		// Server still serves the next requests
		const again = await client.get('/files/big.bin');
		assert.ok(Buffer.from(await again.arrayBuffer()).equals(big));
	}));

	test('missing file and directory -> 404',() => testRouter(router, async (client) => {
		assert.equal((await client.get('/files/nope.txt')).status, 404);
		assert.equal((await client.get('/files/')).status, 404);
	}));
});
