import { Mousse } from '@tyren/mousse';

export const port = 8080;

/**
 * uWS pub/sub : subscribers listen on a topic, a broadcaster publishes app-wide.
 * c.mousse.publish reaches every ws route (and the sender) ; c.publish stays
 * scoped to the route and skips the sender.
 */
export const app = new Mousse()
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
	.setDefaultHandler({handle : (c) => c.respond('Nothing to see here !')});
