import {Mousse} from '../src/mousse.js';
import {Context} from '../src/context.js';

function delay(t : number, val : string) : Promise<string>{
	return new Promise(function(resolve) {
		setTimeout(function() {
				resolve(val);
		}, t);
	});
}

async function someAsyncTask() {
	return delay(500, 'Hey wait for me!');
}

const app = new Mousse({
	key_file_name: 'misc/key.pem',
	cert_file_name: 'misc/cert.pem',
	passphrase: '1234'
}).get('/*', async (context : Context) => {

	let r = await someAsyncTask();

	// You can either return the value or respond directly with it
	// context.respond(r);

	return r;

}).listen(8080, (token, port) => {
	if (token) {
		console.log('Listening to port ' + port);
	} else {
		console.log('Failed to listen to port ' + port);
	}
});