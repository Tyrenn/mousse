import { Mousse } from '@tyren/mousse';

export const port = 8080;

/**
 * Server-Sent Events : the sse handler receives an already sustained context.
 * Try it : curl -N http://localhost:8080/clock
 */
export const app = new Mousse()
	// Comment frames every 15s keep proxies from closing the idle stream
	.sse('/clock', {heartbeat : 15000}, (c) => {
		c.send('welcome');

		const interval = setInterval(() => c.send({time : new Date().toISOString()}, {event : 'tick'}), 1000);

		// The client went away : release everything the stream holds
		c.onAbort(() => clearInterval(interval));
	})
	// Any get route can open a channel itself with sustain()
	.get('/manual', (c) => {
		c.sustain();
		c.send('sustained by hand');
		// Responding ends the stream from the server
		c.respond();
	});
