import { Mousse, Router, HTTPError, DefaultRateLimiter } from '@tyren/mousse';

export const port = 8080;

/**
 * A rate limiter is a module, like a body parser. Set on a router, it covers all
 * its routes with a single counter per client. A route can replace it or disable it.
 */
const api = new Router({rateLimiter : new DefaultRateLimiter({max : 100, timeWindow : '1 minute'})})
	.get('/users', () => [{id : 1}, {id : 2}])
	.get('/health', {rateLimiter : false}, () => 'ok')
	.post('/search', {rateLimiter : new DefaultRateLimiter({max : 10})}, () => []);

const login = new DefaultRateLimiter({
	max : 5,
	timeWindow : '15 minutes',
	errorResponseBuilder : (c, {after}) => new HTTPError(429, `Too many attempts, try again in ${after}`)
});

// Reusing a limiter shares its counters : both routes draw from the same 3 per hour
const otp = new DefaultRateLimiter({max : 3, timeWindow : '1 hour'});

export const app = new Mousse()
	.use('/api', api)
	.post('/login', {rateLimiter : login}, () => ({token : 'abc'}))
	.post('/otp/send', {rateLimiter : otp}, () => ({sent : true}))
	.post('/otp/resend', {rateLimiter : otp}, () => ({sent : true}));
