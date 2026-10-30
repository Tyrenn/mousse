import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Mousse, Router, testRouter, HTTPError, RateLimitError, DefaultRateLimiter, type RateLimitStore, type RateLimiter } from '@tyren/mousse';
import { z } from 'zod';

const sleep = (ms : number) => new Promise((resolve) => setTimeout(resolve, ms));

async function listen(app : Mousse){
	const port = await new Promise<number>((resolve) => app.listen(0, (_, port) => resolve(port)));
	return `http://127.0.0.1:${port}`;
}

describe('scope', () => {
	test('on a route : only this route is limited', () => {
		const router = new Router()
			.get('/limited', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => 'ok')
			.get('/free', () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/limited')).status, 200);
			assert.equal((await client.get('/limited')).status, 429);
			assert.equal((await client.get('/free')).status, 200);
			assert.equal((await client.get('/free')).status, 200);
		});
	});

	test('on a router : its routes share one counter', () => {
		const router = new Router({rateLimiter : new DefaultRateLimiter({max : 2})})
			.get('/a', () => 'ok')
			.get('/b', () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/b')).status, 200);
			assert.equal((await client.get('/a')).status, 429);
			assert.equal((await client.get('/b')).status, 429);
		});
	});

	test('a route replaces the limiter of its router', () => {
		const router = new Router({rateLimiter : new DefaultRateLimiter({max : 1})})
			.get('/a', {rateLimiter : new DefaultRateLimiter({max : 2})}, () => 'ok')
			.get('/b', () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/a')).status, 429);
			// Replaced, not stacked : the router counter was not touched
			assert.equal((await client.get('/b')).status, 200);
			assert.equal((await client.get('/b')).status, 429);
		});
	});

	test('false disables the limiter of its router', () => {
		const router = new Router({rateLimiter : new DefaultRateLimiter({max : 0})})
			.get('/health', {rateLimiter : false}, () => 'ok')
			.get('/a', () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/health');
			assert.equal(res.status, 200);
			assert.equal(res.headers.get('x-ratelimit-limit'), null);
			assert.equal((await client.get('/a')).status, 429);
		});
	});

	test('a mounted router keeps its limiter, others inherit the parent one', () => {
		const child = new Router({rateLimiter : new DefaultRateLimiter({max : 1})}).get('/own', () => 'ok');
		const bare = new Router().get('/inherited', () => 'ok');
		const opted = new Router({rateLimiter : false}).get('/none', () => 'ok');
		const parent = new Router({rateLimiter : new DefaultRateLimiter({max : 2})}).use('/v1', child).use('/v1', bare).use('/v1', opted);

		return testRouter(parent, async (client) => {
			assert.equal((await client.get('/v1/own')).headers.get('x-ratelimit-limit'), '1');
			assert.equal((await client.get('/v1/inherited')).headers.get('x-ratelimit-limit'), '2');
			assert.equal((await client.get('/v1/none')).headers.get('x-ratelimit-limit'), null);
		});
	});

	test('setDefaultRateLimiter covers the next routes and the default handler', async () => {
		const app = new Mousse()
			.setDefaultRateLimiter(new DefaultRateLimiter({max : 1}))
			.setDefaultHandler({handle : (c) => c.status(404).respond('Nothing here')})
			.get('/a', () => 'ok');
		const base = await listen(app);

		try{
			assert.equal((await fetch(`${base}/a`)).status, 200);
			assert.equal((await fetch(`${base}/a`)).status, 429);
			assert.equal((await fetch(`${base}/nowhere`)).status, 429);
		} finally {
			app.stop();
		}
	});

	test('reusing a limiter shares its counters across routes', () => {
		const rateLimiter = new DefaultRateLimiter({max : 2});
		const router = new Router()
			.post('/send', {rateLimiter}, () => 'ok')
			.post('/resend', {rateLimiter}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.post('/send')).status, 200);
			assert.equal((await client.post('/resend')).status, 200);
			assert.equal((await client.post('/send')).status, 429);
		});
	});

	test('per route counters on a router, through the key', () => {
		const router = new Router({rateLimiter : new DefaultRateLimiter({max : 1, keyGenerator : (c) => `${c.ip}:${c.route}`})})
			.get('/a', () => 'ok')
			.get('/b', () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/b')).status, 200);
			assert.equal((await client.get('/a')).status, 429);
		});
	});

	test('as a middleware : after authentication, keyed on the user', () => {
		const perUser = new DefaultRateLimiter({max : 1, keyGenerator : (c) => (c as any).user});
		const router = new Router()
			.use((c : any) => { c.user = c.getHeader('x-user'); })
			.get('/a', (c) => perUser.check(c), () => 'ok');
		const as = (user : string) => ({headers : {'x-user' : user}});

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a', as('ada'))).status, 200);
			assert.equal((await client.get('/a', as('ada'))).status, 429);
			assert.equal((await client.get('/a', as('alan'))).status, 200);
		});
	});

	test('a limiter reached twice by a request counts it once', () => {
		const rateLimiter = new DefaultRateLimiter({max : 2});
		const router = new Router().get('/a', {rateLimiter}, (c) => rateLimiter.check(c), () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).headers.get('x-ratelimit-remaining'), '1');
			assert.equal((await client.get('/a')).headers.get('x-ratelimit-remaining'), '0');
		});
	});
});

describe('runs before anything is analysed', () => {
	test('requests with invalid params or query are counted', () => {
		const router = new Router().get('/users/:id', {
			rateLimiter : new DefaultRateLimiter({max : 2}),
			schemas : {Params : z.object({id : z.string().regex(/^\d+$/)}), Query : z.object({page : z.coerce.number()})}
		}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/users/abc?page=1')).status, 400);
			assert.equal((await client.get('/users/1?page=abc')).status, 400);
			assert.equal((await client.get('/users/abc?page=abc')).status, 429);
			assert.equal((await client.get('/users/1?page=1')).status, 429);
		});
	});

	test('an expensive schema is not run once the limit is reached', async () => {
		let validations = 0;
		const expensive = z.object({q : z.string()}).refine(async () => { validations++; return false; });
		const router = new Router().get('/search', {rateLimiter : new DefaultRateLimiter({max : 2}), schemas : {Query : expensive}}, () => 'ok');

		await testRouter(router, async (client) => {
			await client.get('/search?q=a');
			await client.get('/search?q=a');
			assert.ok(validations > 0);

			// Zod may run an async refinement several times per validation : only compare before and after
			const beforeLimit = validations;
			for(let i = 0; i < 3; i++)
				assert.equal((await client.get('/search?q=a')).status, 429);
			assert.equal(validations, beforeLimit);
		});
	});

	test('bodies over the limit are counted', () => {
		const router = new Router().post('/upload', {rateLimiter : new DefaultRateLimiter({max : 1}), bodyLimit : 10}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.post('/upload', 'a'.repeat(100))).status, 413);
			assert.equal((await client.post('/upload', 'a'.repeat(100))).status, 429);
		});
	});

	test('headers stay on a request rejected later on', () => {
		const router = new Router().get('/a', {
			rateLimiter : new DefaultRateLimiter({max : 5}),
			schemas : {Query : z.object({page : z.coerce.number()})}
		}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a?page=abc');
			assert.equal(res.status, 400);
			assert.equal(res.headers.get('x-ratelimit-remaining'), '4');
		});
	});

	test('nothing else runs on rejection', async () => {
		let middleware = 0, handler = 0;
		const router = new Router()
			.use(() => { middleware++; })
			.post('/a', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => { handler++; return 'ok'; });

		await testRouter(router, async (client) => {
			await client.post('/a', {some : 'body'});
			assert.equal((await client.post('/a', {some : 'body'})).status, 429);
		});

		assert.equal(middleware, 1);
		assert.equal(handler, 1);
	});

	test('a hook runs before the limiter, and can spare it', () => {
		const router = new Router()
			.onRequest((c) => { if(c.getHeader('x-blocked')) return c.status(403).respond('no'); })
			.get('/a', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a', {headers : {'x-blocked' : 'yes'}})).status, 403);
			assert.equal((await client.get('/a')).status, 200);
		});
	});
});

describe('custom limiter', () => {
	test('any implementation of the interface fits', () => {
		const rateLimiter : RateLimiter = {check : (c) => { if(c.getHeader('x-deny')) throw new HTTPError(429, 'Denied'); }};
		const router = new Router({rateLimiter}).get('/a', () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			const res = await client.get('/a', {headers : {'x-deny' : 'yes'}});
			assert.equal(res.status, 429);
			assert.deepEqual(await res.json(), {error : 'Denied'});
		});
	});

	test('it may answer through the context', () => {
		const rateLimiter : RateLimiter = {check : (c) => { c.status(503).respond('later'); }};
		let handler = 0;
		const router = new Router({rateLimiter}).get('/a', () => { handler++; return 'ok'; });

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 503);
			assert.equal(handler, 0);
		});
	});
});

describe('rejection', () => {
	test('answers json with the retry delay', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 0, timeWindow : '1 minute'})}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.status, 429);
			assert.deepEqual(await res.json(), {error : 'Rate limit exceeded, retry in 1 minute'});
		});
	});

	test('goes through the route httpErrorHandler', () => {
		const router = new Router({
			httpErrorHandler : {handle : (e, c) => {
				assert.ok(e instanceof RateLimitError);
				c.status(e.statusCode).json({custom : e.after, max : e.max});
			}}
		}).get('/a', {rateLimiter : new DefaultRateLimiter({max : 0, timeWindow : '10s'})}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.deepEqual(await (await client.get('/a')).json(), {custom : '10 seconds', max : 0});
		});
	});

	test('errorResponseBuilder replaces the error', async (t) => {
		t.mock.method(console, 'error', () => {});
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({
			max : 0,
			errorResponseBuilder : (c, {statusCode, after, ban, max}) => new HTTPError(503, `${statusCode} ${after} ${ban} ${max}`)
		})}, () => 'ok');

		await testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.status, 503);
			assert.deepEqual(await res.json(), {error : '429 1 minute false 0'});
		});
	});
});

describe('window', () => {
	test('a new window starts after timeWindow', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 1, timeWindow : 100})}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/a')).status, 429);
			await sleep(150);
			assert.equal((await client.get('/a')).status, 200);
		});
	});

	test('continueExceeding keeps a client out while it keeps trying', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 1, timeWindow : 200, continueExceeding : true})}, () => 'ok');

		return testRouter(router, async (client) => {
			await client.get('/a');
			for(let i = 0; i < 3; i++){
				await sleep(100);
				assert.equal((await client.get('/a')).status, 429);
			}
			await sleep(250);
			assert.equal((await client.get('/a')).status, 200);
		});
	});
});

describe('headers', () => {
	test('under the limit : limit, remaining, reset', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 2, timeWindow : '1 minute'})}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.headers.get('x-ratelimit-limit'), '2');
			assert.equal(res.headers.get('x-ratelimit-remaining'), '1');
			assert.equal(res.headers.get('x-ratelimit-reset'), '60');
			assert.equal(res.headers.get('retry-after'), null);
		});
	});

	test('over the limit : retry-after too', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 0, timeWindow : '1 minute'})}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.headers.get('x-ratelimit-limit'), '0');
			assert.equal(res.headers.get('x-ratelimit-remaining'), '0');
			assert.equal(res.headers.get('x-ratelimit-reset'), '60');
			assert.equal(res.headers.get('retry-after'), '60');
		});
	});

	test('enableDraftSpec renames them', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 2, enableDraftSpec : true})}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.headers.get('ratelimit-limit'), '2');
			assert.equal(res.headers.get('x-ratelimit-limit'), null);
		});
	});

	test('each header can be turned off', () => {
		const router = new Router()
			.get('/under', {rateLimiter : new DefaultRateLimiter({max : 1, addHeadersOnExceeding : {'x-ratelimit-reset' : false}})}, () => 'ok')
			.get('/over', {rateLimiter : new DefaultRateLimiter({max : 0, addHeaders : {'retry-after' : false}})}, () => 'ok');

		return testRouter(router, async (client) => {
			const under = await client.get('/under');
			assert.equal(under.headers.get('x-ratelimit-reset'), null);
			assert.equal(under.headers.get('x-ratelimit-limit'), '1');

			const over = await client.get('/over');
			assert.equal(over.headers.get('retry-after'), null);
			assert.equal(over.headers.get('x-ratelimit-limit'), '0');
		});
	});
});

describe('client identification', () => {
	test('keyGenerator separates clients', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 1, keyGenerator : (c) => c.getHeader('x-api-key') ?? 'anonymous'})}, () => 'ok');
		const as = (key : string) => ({headers : {'x-api-key' : key}});

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a', as('alice'))).status, 200);
			assert.equal((await client.get('/a', as('alice'))).status, 429);
			assert.equal((await client.get('/a', as('bob'))).status, 200);
		});
	});

	test('the default key ignores x-forwarded-for without trustProxy', async () => {
		const app = new Mousse().get('/a', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => 'ok');
		const base = await listen(app);
		const get = (forwarded : string) => fetch(`${base}/a`, {headers : {'x-forwarded-for' : forwarded}});

		try{
			assert.equal((await get('1.1.1.1')).status, 200);
			assert.equal((await get('2.2.2.2')).status, 429);
		} finally {
			app.stop();
		}
	});

	test('behind trusted proxies, a forged x-forwarded-for does not escape the limit', async () => {
		const app = new Mousse({trustProxy : ['loopback']}).get('/a', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => 'ok');
		const base = await listen(app);
		const get = (forwarded : string) => fetch(`${base}/a`, {headers : {'x-forwarded-for' : forwarded}});

		try{
			assert.equal((await get('6.6.6.1, 198.51.100.4')).status, 200);
			assert.equal((await get('6.6.6.2, 198.51.100.4')).status, 429);
			assert.equal((await get('6.6.6.3, 198.51.100.5')).status, 200);
		} finally {
			app.stop();
		}
	});

	test('trustProxy : true lets a client forge its key', async () => {
		const app = new Mousse({trustProxy : true}).get('/a', {rateLimiter : new DefaultRateLimiter({max : 1})}, () => 'ok');
		const base = await listen(app);
		const get = (forwarded : string) => fetch(`${base}/a`, {headers : {'x-forwarded-for' : forwarded}});

		try{
			assert.equal((await get('6.6.6.1, 198.51.100.4')).status, 200);
			assert.equal((await get('6.6.6.2, 198.51.100.4')).status, 200);
		} finally {
			app.stop();
		}
	});

	test('allowList skips limiting and counting', () => {
		const router = new Router()
			.get('/keys', {rateLimiter : new DefaultRateLimiter({max : 0, keyGenerator : (c) => c.getHeader('x-api-key') ?? '', allowList : ['internal']})}, () => 'ok')
			.get('/fn', {rateLimiter : new DefaultRateLimiter({max : 0, allowList : (c) => c.getHeader('x-internal') === 'yes'})}, () => 'ok');

		return testRouter(router, async (client) => {
			const keys = await client.get('/keys', {headers : {'x-api-key' : 'internal'}});
			assert.equal(keys.status, 200);
			assert.equal(keys.headers.get('x-ratelimit-limit'), null);
			assert.equal((await client.get('/keys')).status, 429);

			assert.equal((await client.get('/fn', {headers : {'x-internal' : 'yes'}})).status, 200);
			assert.equal((await client.get('/fn')).status, 429);
		});
	});

	test('max and timeWindow can depend on the request', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({
			max : async (c) => c.getHeader('x-plan') === 'pro' ? 2 : 1,
			timeWindow : () => 5000
		})}, () => 'ok');

		return testRouter(router, async (client) => {
			const pro = await client.get('/a', {headers : {'x-plan' : 'pro'}});
			assert.equal(pro.headers.get('x-ratelimit-limit'), '2');
			assert.equal(pro.headers.get('x-ratelimit-reset'), '5');
		});
	});
});

describe('ban', () => {
	test('403 once past the ban threshold', () => {
		const banned : string[] = [];
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 1, ban : 1, onBanReach : (c, key) => banned.push(key)})}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 200);
			assert.equal((await client.get('/a')).status, 429);
			assert.equal(banned.length, 0);
			assert.equal((await client.get('/a')).status, 403);
			assert.equal(banned.length, 1);
		});
	});

	test('ban : 0 answers 403 on the first request over the limit', () => {
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({max : 0, ban : 0})}, () => 'ok');

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 403);
		});
	});
});

describe('callbacks', () => {
	test('onExceeding under the limit, onExceeded over it', () => {
		const calls : string[] = [];
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({
			max : 1,
			keyGenerator : () => 'client',
			onExceeding : (c, key) => calls.push(`exceeding ${key}`),
			onExceeded : (c, key) => calls.push(`exceeded ${key}`)
		})}, () => 'ok');

		return testRouter(router, async (client) => {
			await client.get('/a');
			await client.get('/a');
			assert.deepEqual(calls, ['exceeding client', 'exceeded client']);
		});
	});
});

describe('store', () => {
	const failing : RateLimitStore = {incr : () => { throw new Error('store down'); }};

	test('a failing store fails the request by default', async (t) => {
		t.mock.method(console, 'error', () => {});
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({store : failing})}, () => 'ok');

		await testRouter(router, async (client) => {
			assert.equal((await client.get('/a')).status, 500);
		});
	});

	test('skipOnError lets the request through, without headers', () => {
		const store : RateLimitStore = {incr : async () => { throw new Error('store down'); }};
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({store, skipOnError : true})}, () => 'ok');

		return testRouter(router, async (client) => {
			const res = await client.get('/a');
			assert.equal(res.status, 200);
			assert.equal(res.headers.get('x-ratelimit-limit'), null);
		});
	});

	test('a custom store receives the settings and the name spaced key', () => {
		const calls : any[] = [];
		const store : RateLimitStore = {incr : (key, options) => { calls.push([key, options]); return {current : 1, ttl : 1000}; }};
		const router = new Router().get('/a', {rateLimiter : new DefaultRateLimiter({store, nameSpace : 'login-', max : 3, timeWindow : '2s', keyGenerator : () => 'k', continueExceeding : true})}, () => 'ok');

		return testRouter(router, async (client) => {
			await client.get('/a');
			assert.deepEqual(calls, [['login-k', {timeWindow : 2000, max : 3, continueExceeding : true, exponentialBackoff : false}]]);
		});
	});

	test('two limiters on a store need different name spaces', () => {
		const store : RateLimitStore = {incr : () => ({current : 1, ttl : 1000})};

		new DefaultRateLimiter({store});
		new DefaultRateLimiter({store, nameSpace : 'login-'});
		assert.throws(() => new DefaultRateLimiter({store}), /already used on this store/);
		assert.throws(() => new DefaultRateLimiter({store, nameSpace : 'login-'}), /already used on this store/);
	});
});

describe('invalid options', () => {
	test('throw at creation', () => {
		assert.throws(() => new DefaultRateLimiter({max : -1}), /Invalid rate limit max/);
		assert.throws(() => new DefaultRateLimiter({timeWindow : 'soon'}), /Invalid rate limit time window/);
		assert.throws(() => new DefaultRateLimiter({ipv6Subnet : 200}), /Invalid rate limit ipv6Subnet/);
	});
});

describe('every route kind', () => {
	test('typed routes accept a limiter', () => {
		const router = new Router()
			.post('/users/:id', {
				rateLimiter : new DefaultRateLimiter({max : 1}),
				schemas : {Params : z.object({id : z.string()}), Body : z.object({name : z.string()})}
			}, async (c) => ({id : c.param('id'), name : (await c.body()).name}));

		return testRouter(router, async (client) => {
			assert.deepEqual(await (await client.post('/users/1', {name : 'Ada'})).json(), {id : '1', name : 'Ada'});
			assert.equal((await client.post('/users/1', {name : 'Ada'})).status, 429);
		});
	});

	test('rejects a websocket upgrade with its status', async () => {
		const app = new Mousse().ws('/socket', {rateLimiter : new DefaultRateLimiter({max : 1})}, (c) => { c.send('hi'); });
		const base = new URL(await listen(app));

		const upgrade = () => new Promise<{status : number, body? : string}>((resolve, reject) => {
			const req = http.request({
				port : base.port, path : '/socket', host : '127.0.0.1',
				headers : {connection : 'Upgrade', upgrade : 'websocket', 'sec-websocket-version' : '13', 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ=='}
			});
			req.on('upgrade', (res, socket) => { socket.destroy(); resolve({status : res.statusCode!}); });
			req.on('response', (res) => {
				let body = '';
				res.on('data', (chunk) => body += chunk);
				res.on('end', () => resolve({status : res.statusCode!, body}));
			});
			req.on('error', reject);
			req.end();
		});

		try{
			assert.equal((await upgrade()).status, 101);
			const rejected = await upgrade();
			assert.equal(rejected.status, 429);
			assert.deepEqual(JSON.parse(rejected.body!), {error : 'Rate limit exceeded, retry in 1 minute'});
		} finally {
			app.stop();
		}
	});

	test('sse : answers 429 before the stream opens', () => {
		const router = new Router()
			.sse('/events', {rateLimiter : new DefaultRateLimiter({max : 1})}, (c) => { c.send('hi'); c.respond(); });

		return testRouter(router, async (client) => {
			assert.equal((await client.get('/events')).status, 200);
			assert.equal((await client.get('/events')).status, 429);
		});
	});

	test('sse : used as a middleware, the stream already opened is closed', () => {
		let handler = 0;
		const limiter = new DefaultRateLimiter({max : 0});
		const router = new Router()
			.sse('/events', (c) => limiter.check(c), () => { handler++; });

		return testRouter(router, async (client) => {
			const res = await client.get('/events');
			assert.equal(res.status, 200);
			assert.equal(await res.text(), '');
			assert.equal(handler, 0);
		});
	});
});
