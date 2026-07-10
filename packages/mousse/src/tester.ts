import type { Router } from './router.js';
import type { Mousse } from './mousse.js';

type JsonBody = unknown;

function isRawBody(body : JsonBody) : body is BodyInit {
	return typeof body === 'string'
		|| body instanceof ArrayBuffer
		|| body instanceof Uint8Array
		|| (typeof Blob !== 'undefined' && body instanceof Blob)
		|| (typeof FormData !== 'undefined' && body instanceof FormData)
		|| (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams);
}

function withJsonBody(body : JsonBody, init? : RequestInit) : RequestInit {
	if(body === undefined)
		return init ?? {};

	if(isRawBody(body))
		return {...init, body};

	return {
		...init,
		body : JSON.stringify(body),
		headers : {'content-type' : 'application/json', ...(init?.headers as Record<string, string> | undefined)}
	};
}

/**
 * Fires real HTTP requests against a single ephemeral Mousse instance mounting a Router (or Mousse app).
 * One RouteTester = one listening instance, regardless of how many requests are made through it :
 * testing a whole router means firing several requests through the same tester, never spinning up
 * a new instance per route.
 */
export class RouteTester {

	private _closed : boolean = false;

	private _ready : Promise<{app : Mousse, port : number}>;

	constructor(router : Router<any, any>){
		this._ready = this._start(router);
	}

	private async _start(router : Router<any, any>){
		// Dynamic import avoids a static circular dependency between router.ts and mousse.ts
		const {Mousse} = await import('./mousse.js');

		const app = new Mousse().use(router);
		const port = await new Promise<number>((resolve, reject) => {
			app.listen(0, (listenSocket, port) => {
				if(!listenSocket)
					reject(new Error('RouteTester failed to bind an ephemeral port'));
				else
					resolve(port);
			});
		});

		return {app, port};
	}

	/**
	 * Resolves once the ephemeral instance is listening. Awaiting it explicitly is optional :
	 * every request method already waits for it internally.
	 */
	async ready() : Promise<void> {
		await this._ready;
	}

	async request(method : string, path : string, init? : RequestInit) : Promise<Response> {
		if(this._closed)
			throw new Error('RouteTester has already been closed');

		const {port} = await this._ready;

		return fetch(`http://localhost:${port}${path}`, {...init, method});
	}

	get(path : string, init? : RequestInit) : Promise<Response> {
		return this.request('GET', path, init);
	}

	head(path : string, init? : RequestInit) : Promise<Response> {
		return this.request('HEAD', path, init);
	}

	options(path : string, init? : RequestInit) : Promise<Response> {
		return this.request('OPTIONS', path, init);
	}

	post(path : string, body? : JsonBody, init? : RequestInit) : Promise<Response> {
		return this.request('POST', path, withJsonBody(body, init));
	}

	put(path : string, body? : JsonBody, init? : RequestInit) : Promise<Response> {
		return this.request('PUT', path, withJsonBody(body, init));
	}

	patch(path : string, body? : JsonBody, init? : RequestInit) : Promise<Response> {
		return this.request('PATCH', path, withJsonBody(body, init));
	}

	del(path : string, body? : JsonBody, init? : RequestInit) : Promise<Response> {
		return this.request('DELETE', path, withJsonBody(body, init));
	}

	/**
	 * Stops the ephemeral instance. Safe to call multiple times.
	 */
	async close() : Promise<void> {
		if(this._closed)
			return;

		this._closed = true;

		const {app} = await this._ready;
		app.stop();
	}
}

/**
 * Runs `callback` against a fresh ephemeral instance of `router`, closing it afterwards
 * regardless of success or failure — the recommended way to test a router in a test suite.
 */
export async function testRouter<T>(router : Router<any, any>, callback : (client : RouteTester) => Promise<T> | T) : Promise<T> {
	const client = new RouteTester(router);

	try{
		return await callback(client);
	} finally {
		await client.close();
	}
}
