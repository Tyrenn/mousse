import { Mousse } from '@tyren/mousse';

new Mousse()
	.ws<{ Params: 'room' }>('/chat/:room',
		// Upgrade phase : plain HTTP, answer to refuse the connection
		(c) => {
			if (!c.getHeader('authorization'))
				return c.status(401).respond();
		},
		// Connected phase : backpressure is handled for you
		(c) => {
			c.subscribe(c.param('room'));
			c.onMessage((ws, message) => { c.publish(c.param('room'), message); });
		})
	.listen(3000);
