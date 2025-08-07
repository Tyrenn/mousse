import { App } from 'uWebSockets.js';

App().get('/hello', (res, req) => {
	res.end('Hello from uWS!');
}).listen(3004, (token) => {
	if (token) console.log('Listening on port 3004');
});