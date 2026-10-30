import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router, testRouter } from '@tyren/mousse';

async function readFrames(res : Response, count : number) : Promise<string> {
	const reader = res.body!.getReader();
	const decoder = new TextDecoder();
	let received = '';

	while((received.match(/data:/g) ?? []).length < count){
		const {value, done} = await reader.read();
		if(done)
			break;
		received += decoder.decode(value, {stream : true});
	}

	await reader.cancel();
	return received;
}

describe('server-sent events', () => {
	test('sse handler receives an already sustained context', () => testRouter(
		new Router().sse('/events', (c) => {
			c.send('welcome');
			c.send({time : 123});
		}),
		async (client) => {
			const res = await client.get('/events');
			const frames = await readFrames(res, 2);
			assert.ok(frames.includes('data: welcome') || frames.includes('data:welcome'));
			assert.ok(frames.includes('{"time":123}'));
		}
	));

	test('manual sustain on a regular get route', () => testRouter(
		new Router().get('/manual', (c) => {
			c.sustain();
			assert.equal(c.sustained, true);
			c.send('hello');
		}),
		async (client) => {
			const frames = await readFrames(await client.get('/manual'), 1);
			assert.ok(frames.includes('hello'));
		}
	));

	test('send before sustain throws inside the handler, request gets a 500', () => testRouter(
		new Router().get('/unsustained', (c) => {
			c.send('too early');
		}),
		async (client) => {
			assert.equal((await client.get('/unsustained')).status, 500);
		}
	));

	test('multi-line data and event fields are framed per spec', () => testRouter(
		new Router().sse('/framed', (c) => {
			c.send('line one\nline two');
			c.send({n : 1}, {event : 'update', id : 42, retry : 3000});
			c.send('x', {event : 'evil\ndata: injected'});
		}),
		async (client) => {
			const frames = await readFrames(await client.get('/framed'), 4);
			assert.ok(frames.includes('data: line one\ndata: line two\n\n'));
			assert.ok(frames.includes('event: update\nid: 42\nretry: 3000\ndata: {"n":1}\n\n'));
			assert.ok(frames.includes('event: evildata: injected\ndata: x\n\n'));
		}
	));

	test('middleware headers reach the event stream', () => testRouter(
		new Router()
			.use((c) => { c.header('access-control-allow-origin', '*'); })
			.sse('/cors', (c) => c.send('hi')),
		async (client) => {
			const res = await client.get('/cors');
			assert.equal(res.headers.get('access-control-allow-origin'), '*');
			assert.equal(res.headers.get('content-type'), 'text/event-stream');
			await res.body!.cancel();
		}
	));

	test('heartbeat sends comment frames', () => testRouter(
		new Router().sse('/beat', {heartbeat : 20}, () => {}),
		async (client) => {
			const res = await client.get('/beat');
			const reader = res.body!.getReader();
			const {value} = await reader.read();
			assert.equal(new TextDecoder().decode(value), ':\n\n');
			await reader.cancel();
		}
	));

	test('respond() ends the stream from the server', () => testRouter(
		new Router().sse('/finite', (c) => {
			c.send('last');
			c.respond();
		}),
		async (client) => {
			assert.equal(await (await client.get('/finite')).text(), 'data: last\n\n');
		}
	));

	test('onAbort fires when the client disconnects, onResponse reports it', async () => {
		let cleaned! : () => void;
		const cleanedUp = new Promise<void>((resolve) => cleaned = resolve);
		let reported! : (aborted : boolean) => void;
		const hooked = new Promise<boolean>((resolve) => reported = resolve);

		await testRouter(
			new Router()
				.onResponse((c, info) => reported(info.aborted))
				.sse('/live', {heartbeat : 10}, (c) => {
					const timer = setInterval(() => c.send('tick'), 5);
					c.onAbort(() => {
						clearInterval(timer);
						cleaned();
					});
				}),
			async (client) => {
				await readFrames(await client.get('/live'), 2);
				await cleanedUp;
				assert.equal(await hooked, true);
			}
		);
	});
});
