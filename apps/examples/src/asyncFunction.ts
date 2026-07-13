import { Mousse, Context } from '@tyren/mousse';

export const port = 8080;

function delay(t : number, val : string) : Promise<string>{
	return new Promise((resolve) => setTimeout(() => resolve(val), t));
}

async function someAsyncTask() {
	return delay(500, 'Hey wait for me!');
}

/**
 * Handlers can be async : the context stays fully usable after any await.
 */
export const app = new Mousse({
	// SSL options : providing key + cert switches to an SSLApp
	// key_file_name: 'misc/key.pem',
	// cert_file_name: 'misc/cert.pem',
	// passphrase: '1234'
}).get('/*', async (context : Context) => {

	let r = await someAsyncTask();

	// You can either return the value or respond directly with it
	// context.respond(r);

	return r;
});
