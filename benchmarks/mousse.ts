import {Mousse} from "../src/mousse.js";

const webserver = new Mousse();

webserver.get('/hello', (c) => {
	console.log('TEST');
	c.respond('Hello from Mousse');
});

webserver.listen(3004, (ls) => {
	console.log("Mousse is listening", ls)
});