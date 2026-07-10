import { Mousse } from 'mousse';

export const port = 8080;

type ContextExtension = {
	myAdditionalProp : boolean;
	myAdditionalFunction : () => string;
}

/**
 * Middlewares often attach data to the context (a user, a session...).
 * Declare the extension in the second generic slot : every function of the route sees it, no cast needed.
 */
export const app = new Mousse();

app.post<{Body : 'test'}, ContextExtension>('/',
	// A middleware can now extend the context
	(c) => {
		c.myAdditionalProp = true;
		c.myAdditionalFunction = () => 'Hello';
	},
	(c) => {
		// No type errors
		return {prop : c.myAdditionalProp, greeting : c.myAdditionalFunction()};
	});
