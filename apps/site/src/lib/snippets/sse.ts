import { Mousse } from '@tyren/mousse';

new Mousse()
	// Heartbeats keep proxies from closing an idle stream
	.sse('/clock', { heartbeat: 15000 }, (c) => {
		const timer = setInterval(() => {
			c.send({ now: Date.now() }, { event: 'tick' });
		}, 1000);

		c.onAbort(() => clearInterval(timer));
	})
	.listen(3000);
