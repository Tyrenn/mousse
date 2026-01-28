import {Mousse} from '../src/mousse.js';
import {Context} from '../src/context.js';

const app = new Mousse({
	// Options
	// key_file_name: 'misc/key.pem',
	// cert_file_name: 'misc/cert.pem',
	// passphrase: '1234'
})
.ws('/subscriber', {maxBackPressure : 16 * 1024}, (c : Context) => {
	c.onOpen((ws) => {
		// Let this client listen to topic "broadcast"
		ws.subscribe('broadcast');
	});

	c.onMessage((ws, message, isBinary) => {
		// Print the message
		console.log(message);
	})
})
.ws('/broadcaster', {maxBackPressure : 16 * 1024}, (c : Context) => {
	c.onMessage((ws, message, isBinary) => {
		// Broadcast the message
		ws.publish('broadcast', message, isBinary);
	})
})
.setDefaultHandler((c) => c.respond('Nothing to see here !'))
.listen(8080, (token, port) => {
	if (token) {
		console.log('Listening to port ' + port);
	} else {
		console.log('Failed to listen to port ' + port);
	}
});