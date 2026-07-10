import { Mousse } from 'mousse';

export const port = 8080;

/**
 * stop() closes the listen socket : in-flight work finishes, no new connection is accepted.
 */
export const app = new Mousse()
	.get('/shutdown', (c) => {
		c.respond('Shutting down now !');
		c.mousse.stop();
	});
