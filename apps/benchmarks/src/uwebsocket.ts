import { App } from 'uWebSockets.js';

App().get('/hello', (res, req) => {
	res.end('Hello from uWS!');
}).listen(3010, (token) => {
	if (token) console.log('uWebSockets.js listening on http://localhost:3010');
});
