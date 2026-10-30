import { Mousse } from '@tyren/mousse';

new Mousse()
	.get('/hello', () => 'Hello World !')
	.get('/users/:id', (c) => ({ id: c.param('id') }))
	.post('/echo', (c) => c.body())
	.ws('/chat', (c) => {
		c.onMessage((ws, message) => { ws.send(message); });
	})
	.sse('/events', (c) => c.send('welcome'))
	.listen(3000);
