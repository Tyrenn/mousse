import { Mousse } from "mousse";

const webserver = new Mousse();

webserver.get('/hello', (c) => {
	c.respond('Hello from Mousse');
});

webserver.listen(3011, (ls) => {
	if (ls) console.log("Mousse listening on http://localhost:3011");
});
