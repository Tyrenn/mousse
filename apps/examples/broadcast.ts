import {Mousse} from 'mousse';

const app = new Mousse({
	// Options
	// key_file_name: 'misc/key.pem',
	// cert_file_name: 'misc/cert.pem',
	// passphrase: '1234'
})
// The ws handler receives an already connected WSContext
.ws('/subscriber', {maxBackPressure : 16 * 1024}, (c) => {
	// Let this client listen to topic "broadcast"
	c.subscribe('broadcast');

	c.onMessage((ws, message) => {
		// Print the message
		console.log(message);
	});
})
.ws('/broadcaster', {maxBackPressure : 16 * 1024}, (c) => {
	c.onMessage((ws, message, isBinary) => {
		// Broadcast the message to every subscriber, across all ws routes
		c.mousse.publish('broadcast', message, isBinary);
	});
})
.setDefaultHandler({handle : (c) => c.respond('Nothing to see here !')})
.listen(8080, (token, port) => {
	if (token) {
		console.log('Listening to port ' + port);
	} else {
		console.log('Failed to listen to port ' + port);
	}
});
