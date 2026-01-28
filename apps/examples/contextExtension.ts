import {Mousse} from '../src/mousse.js';

type ContextExtension = {
	myAdditionalProp : boolean;
	myAdditionalFunction : () => void;
}

const app = new Mousse();

app.post<{Body : "test"}, ContextExtension>('/', 
	// A middleware can now extends context
	(c) => {
		
		c.myAdditionalProp = true;
		c.myAdditionalFunction = () => console.log('Hello');
	},
	(c) => {
		// No type errors
		console.log(c.myAdditionalProp);
		c.myAdditionalFunction();
});