import * as HyperExpress from 'hyper-express';

const webserver = HyperExpress.express();

// Create GET route to serve 'Hello World'
webserver.get('/hello', (request, response) => {
	response.send('Hello from Hyper-Express');
});

// Activate webserver by calling .listen(port, callback);
webserver.listen(3003)
	.then((socket) => console.log('Webserver started on port 3003'))
	.catch((error) => console.log('Failed to start webserver on port 3003'));