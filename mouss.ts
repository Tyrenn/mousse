//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Context } from './context.ts';
//@ts-ignore
import { Handlers, MousseOptions, RequestMethod } from "./types.ts";

export class Mouss{
	server: Server;
	router = new Router();


	constructor(opt: MousseOptions) {
	if ((typeof opt.certFile === 'string') && (typeof opt.keyFile === 'string')) {
		this.server = serveTLS(opt as HTTPSOptions);
	}
	else {
		console.log("Mousse init");
		this.server = serve(opt as HTTPOptions);
		console.log(this.server);
	}
	}

	async start() : Promise<void>{
		for await (const req of this.server) {
			let c = new Context(req);
			
			this.router.handle(c, () => {});
		}
	}

	add(path: string, method: RequestMethod, ...handlers: Handlers): Mouss {
		this.router.add(path, method, ...handlers);

		return this;
	}

	//TODO check async and promise ?

	delete(path: string, handlers : Handlers) : Mouss {
		return this.add(path, "DELETE", ...handlers);
	}
	get(path: string, handlers : Handlers) : Mouss {
		return this.add(path, "GET", ...handlers);
	}
	head(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "HEAD", ...handlers);
	}
	options(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "OPTIONS", ...handlers);
	}
	patch(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "PATCH", ...handlers);
	}
	post(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "POST", ...handlers);
	}
	put(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "PUT", ...handlers);
	}
	trace(path: string, handlers: Handlers) : Mouss {
		return this.add(path, "TRACE", ...handlers);
	}
	any(path: string, handlers: Handlers) : Mouss {
		const methods : Array<RequestMethod> = [
			"DELETE",
			"GET",
			"HEAD",
			"OPTIONS",
			"PATCH",
			"POST",
			"PUT",
			"TRACE",
		];
		for (const method of methods) {
			this.add(path, method, ...handlers);
		}
		return this;
	}

	ws(path: string, ...handlers: Handlers): Mouss{
		return this.add(path, "WS", ...handlers);
	}
};