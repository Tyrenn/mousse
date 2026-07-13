import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Mousse } from '@tyren/mousse';

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

describe('websockets', () => {
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
