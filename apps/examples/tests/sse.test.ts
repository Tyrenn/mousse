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
});
