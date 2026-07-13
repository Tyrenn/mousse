import { Mousse } from '@tyren/mousse';

export const port = 8080;

/**
 * Server-Sent Events : the sse handler receives an already sustained context.
 * Try it : curl -N http://localhost:8080/clock
 */
export const app = new Mousse()
	.sse('/clock', (c) => {
		c.send('welcome');

		const interval = setInterval(() => {
			// c.ended becomes true when the client disconnects ; send() would throw
			if(c.ended)
				clearInterval(interval);
			else
				c.send({time : new Date().toISOString()});
		}, 1000);
	})
	// Any get route can open a channel itself with sustain()
	.get('/manual', (c) => {
		c.sustain();
		c.send('sustained by hand');
	});
