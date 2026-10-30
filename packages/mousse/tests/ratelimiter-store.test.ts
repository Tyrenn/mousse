import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import RedisMock from 'ioredis-mock';
import { LocalRateLimitStore, RedisRateLimitStore } from '@tyren/mousse';

const options = {timeWindow : 1000, max : 2, continueExceeding : false, exponentialBackoff : false};

describe('LocalRateLimitStore', () => {
	test('counts per key inside a fixed window', (t) => {
		t.mock.timers.enable({apis : ['Date']});
		const store = new LocalRateLimitStore();

		assert.deepEqual(store.incr('a', options), {current : 1, ttl : 1000});
		t.mock.timers.tick(400);
		// The window started with the first request : it does not slide
		assert.deepEqual(store.incr('a', options), {current : 2, ttl : 600});
		assert.deepEqual(store.incr('b', options), {current : 1, ttl : 1000});

		t.mock.timers.tick(600);
		assert.deepEqual(store.incr('a', options), {current : 1, ttl : 1000});
	});

	test('over the limit keeps the window running by default', (t) => {
		t.mock.timers.enable({apis : ['Date']});
		const store = new LocalRateLimitStore();

		store.incr('a', options);
		store.incr('a', options);
		t.mock.timers.tick(500);
		assert.deepEqual(store.incr('a', options), {current : 3, ttl : 500});
	});

	test('continueExceeding restarts the window over the limit only', (t) => {
		t.mock.timers.enable({apis : ['Date']});
		const store = new LocalRateLimitStore();
		const renew = {...options, continueExceeding : true};

		store.incr('a', renew);
		t.mock.timers.tick(100);
		assert.deepEqual(store.incr('a', renew), {current : 2, ttl : 900});
		t.mock.timers.tick(500);
		assert.deepEqual(store.incr('a', renew), {current : 3, ttl : 1000});
	});

	test('exponentialBackoff doubles the delay and is really enforced', (t) => {
		t.mock.timers.enable({apis : ['Date']});
		const store = new LocalRateLimitStore();
		const backoff = {...options, exponentialBackoff : true};

		store.incr('a', backoff);
		store.incr('a', backoff);
		assert.deepEqual(store.incr('a', backoff), {current : 3, ttl : 1000});
		assert.deepEqual(store.incr('a', backoff), {current : 4, ttl : 2000});
		assert.deepEqual(store.incr('a', backoff), {current : 5, ttl : 4000});

		// Past the base window, still inside the backoff
		t.mock.timers.tick(3000);
		assert.equal(store.incr('a', backoff).current, 6);
	});

	test('continueExceeding wins over exponentialBackoff', () => {
		const store = new LocalRateLimitStore();
		const both = {...options, continueExceeding : true, exponentialBackoff : true};

		for(let i = 0; i < 5; i++)
			store.incr('a', both);
		assert.ok(store.incr('a', both).ttl <= 1000);
	});

	test('keeps the most recently seen keys', () => {
		const store = new LocalRateLimitStore(2);

		store.incr('a', options);
		store.incr('b', options);
		// 'a' is now the most recent, 'c' pushes 'b' out
		store.incr('a', options);
		store.incr('c', options);

		assert.equal(store.incr('a', options).current, 3);
		assert.equal(store.incr('b', options).current, 1);
	});

	test('invalid cache size throws', () => {
		assert.throws(() => new LocalRateLimitStore(0), /Invalid rate limit cache/);
	});
});

// Runs the real Lua script through an in-process Redis emulation
describe('RedisRateLimitStore', () => {
	const client = () => new RedisMock();

	test('counts per key and returns the remaining ttl', async () => {
		const redis = client();
		await redis.flushall();
		const store = new RedisRateLimitStore(redis as any);

		const first = await store.incr('a', options);
		assert.equal(first.current, 1);
		assert.equal(first.ttl, 1000);

		const second = await store.incr('a', options);
		assert.equal(second.current, 2);
		assert.ok(second.ttl > 0 && second.ttl <= 1000);

		assert.equal((await store.incr('b', options)).current, 1);
		assert.ok(await redis.pttl('mousse-rate-limit-a') > 0);
	});

	test('continueExceeding restarts the window over the limit', async () => {
		const redis = client();
		await redis.flushall();
		const store = new RedisRateLimitStore(redis as any);
		const renew = {...options, continueExceeding : true};

		await store.incr('a', renew);
		await store.incr('a', renew);
		assert.deepEqual(await store.incr('a', renew), {current : 3, ttl : 1000});
	});

	test('exponentialBackoff doubles the delay', async () => {
		const redis = client();
		await redis.flushall();
		const store = new RedisRateLimitStore(redis as any);
		const backoff = {...options, exponentialBackoff : true};

		await store.incr('a', backoff);
		await store.incr('a', backoff);
		assert.equal((await store.incr('a', backoff)).ttl, 1000);
		assert.equal((await store.incr('a', backoff)).ttl, 2000);
		assert.equal((await store.incr('a', backoff)).ttl, 4000);
	});

	test('falls back to eval on NOSCRIPT only', async () => {
		const noScript = {
			evalsha : mock.fn(async () => { throw new Error('NOSCRIPT No matching script.'); }),
			eval : mock.fn(async () => [1, 1000])
		};
		assert.deepEqual(await new RedisRateLimitStore(noScript).incr('a', options), {current : 1, ttl : 1000});
		assert.equal(noScript.eval.mock.callCount(), 1);

		const down = {
			evalsha : mock.fn(async () => { throw new Error('Connection is closed.'); }),
			eval : mock.fn(async () => [1, 1000])
		};
		await assert.rejects(new RedisRateLimitStore(down).incr('a', options), /Connection is closed/);
		assert.equal(down.eval.mock.callCount(), 0);
	});

	test('keys carry the prefix', async () => {
		const calls : unknown[][] = [];
		const redis = {
			evalsha : async (...args : unknown[]) => { calls.push(args); return [1, 1000]; },
			eval : async () => [1, 1000]
		};
		await new RedisRateLimitStore(redis, 'custom-').incr('a', options);
		assert.equal(calls[0][2], 'custom-a');
	});
});
