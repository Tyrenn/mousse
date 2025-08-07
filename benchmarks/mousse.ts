import {Mousse} from "../src/mousse.js";

const webserver = new Mousse();

webserver.get('/hello', (c) => {
	c.respond('Hello from Mousse');
});

webserver.listen(3000, (ls) => {
	console.log("Mousse is listening", ls)
});