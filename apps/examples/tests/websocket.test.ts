import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Mousse, HTTPError } from '@tyren/mousse';

/**
 * WebSocket upgrades are not covered by RouteTester : these tests bind a real
 * ephemeral port (listen(0)) and drive it with the native WebSocket client.
 */
function listen(app : Mousse) : Promise<number> {
	return new Promise((resolve, reject) => {
		app.listen(0, (listenSocket, port) => listenSocket ? resolve(port) : reject(new Error('failed to listen')));
	});
}

function connect(url : string) : Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(url);
		socket.onopen = () => resolve(socket);
		socket.onerror = () => reject(new Error(`connection failed on ${url}`));
	});
}

function nextMessage(socket : WebSocket) : Promise<string> {
	return new Promise((resolve) => {
		socket.onmessage = (event) => resolve(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
	});
}

// The native client hides the status of a refused upgrade
function upgrade(port : number, path : string) : Promise<{status : number, body : string}> {
	return new Promise((resolve, reject) => {
		const req = http.request({
			port, path, host : '127.0.0.1',
			headers : {connection : 'Upgrade', upgrade : 'websocket', 'sec-websocket-version' : '13', 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ=='}
		});
		req.on('upgrade', (res, socket) => { socket.destroy(); resolve({status : res.statusCode!, body : ''}); });
		req.on('response', (res) => {
			let body = '';
			res.on('data', (chunk) => body += chunk);
			res.on('end', () => resolve({status : res.statusCode!, body}));
		});
		req.on('error', reject);
		req.end();
	});
}

describe('websockets', () => {
	test('an HTTPError thrown by a middleware rejects the upgrade with its status', async (t) => {
		const logged = t.mock.method(console, 'error', () => {});
		let opened = 0;
		const app = new Mousse()
			.ws('/client', () => { throw new HTTPError(401, 'Who are you ?'); }, () => { opened++; })
			.ws('/server', () => { throw new HTTPError(503, 'Down'); }, () => { opened++; })
			.ws('/plain', () => { throw new Error('boom'); }, () => { opened++; })
			.ws('/custom', {httpErrorHandler : {handle : (e, c) => c.status(418).respond('teapot')}}, () => { throw new HTTPError(401); }, () => { opened++; });
		const port = await listen(app);

		try{
			assert.deepEqual(await upgrade(port, '/client'), {status : 401, body : '{"error":"Who are you ?"}'});
			assert.equal(logged.mock.callCount(), 0);

			// Like on HTTP routes : only 5xx are logged
			assert.deepEqual(await upgrade(port, '/server'), {status : 503, body : '{"error":"Down"}'});
			assert.equal(logged.mock.callCount(), 1);

			assert.equal((await upgrade(port, '/plain')).status, 500);
			assert.deepEqual(await upgrade(port, '/custom'), {status : 418, body : 'teapot'});
			assert.equal(opened, 0);
		}
		finally{
			app.stop();
		}
	});

	test('request hooks run on the upgrade request, before middlewares', async () => {
		const ran : string[] = [];
		const app = new Mousse()
			.onRequest(() => { ran.push('router hook'); })
			.ws('/open', {onRequest : () => { ran.push('route hook'); }}, () => { ran.push('middleware'); }, () => {})
			.ws('/closed', {onRequest : (c) => c.status(403).respond('no')}, () => { ran.push('never'); }, () => { ran.push('never'); });
		const port = await listen(app);

		try{
			assert.equal((await upgrade(port, '/open')).status, 101);
			assert.deepEqual(ran, ['router hook', 'route hook', 'middleware']);

			ran.length = 0;
			assert.deepEqual(await upgrade(port, '/closed'), {status : 403, body : 'no'});
			assert.deepEqual(ran, ['router hook']);
		}
		finally{
			app.stop();
		}
	});

	test('echo : handler runs connected, onMessage replies', async () => {
		const app = new Mousse().ws('/echo', (c) => {
			c.onMessage((_ws, message) => { c.send(message); });
		});
		const port = await listen(app);

		try{
			const socket = await connect(`ws://localhost:${port}/echo`);
			const reply = nextMessage(socket);
			socket.send('bubble');
			assert.equal(await reply, 'bubble');
			socket.close();
		}
		finally{
			app.stop();
		}
	});

	test('upgrade middleware rejects by responding', async () => {
		const app = new Mousse().ws('/private',
			(c) => {
				if(!c.getHeader('authorization'))
					return c.status(401).respond();
			},
			(c) => {
				c.send('connected');
			});
		const port = await listen(app);

		try{
			await assert.rejects(connect(`ws://localhost:${port}/private`));
		}
		finally{
			app.stop();
		}
	});

	test('params and immediate send on connection', async () => {
		const app = new Mousse().ws('/rooms/:room', (c) => {
			c.send(`joined ${c.param('room')}`);
		});
		const port = await listen(app);

		try{
			const socket = await connect(`ws://localhost:${port}/rooms/lobby`);
			assert.equal(await nextMessage(socket), 'joined lobby');
			socket.close();
		}
		finally{
			app.stop();
		}
	});

	test('publish reaches route subscribers, not the sender', async () => {
		const app = new Mousse().ws<{Params : 'room'}>('/chat/:room', (c) => {
			c.subscribe(c.param('room'));
			c.onMessage((_ws, message) => { c.publish(c.param('room'), message); });
		});
		const port = await listen(app);

		try{
			const alice = await connect(`ws://localhost:${port}/chat/general`);
			const bob = await connect(`ws://localhost:${port}/chat/general`);

			const bobReceives = nextMessage(bob);
			alice.send('hi from alice');
			assert.equal(await bobReceives, 'hi from alice');

			alice.close();
			bob.close();
		}
		finally{
			app.stop();
		}
	});
});
