import { Mousse, DefaultRateLimiter } from '@tyren/mousse';

new Mousse({ trustProxy: ['private'] })
	// Every route below : 100 requests per minute, per client
	.setDefaultRateLimiter(new DefaultRateLimiter({ max: 100, timeWindow: '1 minute' }))
	// Stricter here, counted before anything is parsed
	.post('/login', {
		rateLimiter: new DefaultRateLimiter({ max: 5, timeWindow: '15 minutes' })
	}, () => ({ token: 'abc' }))
	// Or not at all
	.get('/health', { rateLimiter: false }, () => 'ok')
	.listen(3000);
