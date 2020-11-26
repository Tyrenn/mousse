//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { Context, HTTPContext, WSContext } from './context.ts';
//@ts-ignore
import { Handlers, MousseOptions, Method} from "./types.ts";
//@ts-ignore
import { WebSocketPool } from './websocket.ts';
//@ts-ignore
import { acceptWebSocket, acceptable, isWebSocketCloseEvent } from 'https://deno.land/std@0.78.0/ws/mod.ts';

export class Mousse{
	server: Server;
	opt: MousseOptions;
	router = new Router();

	websockets: Map<string, WebSocketPool> = new Map<string, WebSocketPool>();

	#wsupgraded: boolean = false;

	start: () => Promise<void>;

	constructor(opt: MousseOptions) {
		this.opt = opt;
		if ((typeof opt.certFile === 'string') && (typeof opt.keyFile === 'string')) {
			this.server = serveTLS(opt as HTTPSOptions);
		}
		else {
			this.server = serve(opt as HTTPOptions);
		}
		this.start = this.startNoWS;
	}

	private async startWS() {
		for await (const req of this.server) {
			
			console.log("App WS : ", req.url, req.method);

			if (acceptable(req)) {
				console.log("Acceptable");
				const { conn, r: bufReader, w: bufWriter, headers } = req;
				let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers });
				let context = new WSContext(this, req, websocket);
				try {
					for await (const event of websocket) {
						context.event = event;

						this.router.handle(context, () => { });

                        if (isWebSocketCloseEvent(event)) {
							context.close();
                        }
                    }
                }
                catch (err) {
                    console.error("Failed to receive frame:", err);
					context.close();
                }
			}
			else {
				let c = 

				this.router.handle(new HTTPContext(this, req), () => {});
			}
		}
	}

	private async startNoWS() {
		for await (const req of this.server) {
			console.log("App NOWS : ", req.url, req.method);
			let c = new HTTPContext(this, req);
			this.router.handle(c, () => {});
		}
	}

	private wsupgrade(): void {
		if (!this.#wsupgraded) {
			this.#wsupgraded = true;
			this.start = this.startWS;	
		}
	}

	use(path: string, ...handlers: Handlers): Mousse{
		if (!this.#wsupgraded)
			this.wsupgrade();
		this.router.use(path, ...handlers);
		return this;
    }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
    add(path : string, method : Method | Array<Method>, ...handlers : Handlers) : Mousse {
		this.router.add(path, method, ...handlers);
		return this;
    }
    any(path: string, ...handlers: Handlers) : Mousse {
		this.router.any(path, ...handlers);
		return this;
	}
	
	delete(path: string, ...handlers : Handlers) : Mousse {
		this.router.delete(path, ...handlers);
		return this;
	}
	get(path: string, ...handlers : Handlers) : Mousse {
		this.router.get(path, ...handlers);
		return this;
	}
	head(path: string, ...handlers: Handlers) : Mousse {
		this.router.head(path, ...handlers);
		return this;
	}
	options(path: string, handlers: Handlers): Mousse {
		this.router.options(path, ...handlers);
		return this;
	}
	patch(path: string, handlers: Handlers): Mousse {
		this.router.patch(path, ...handlers);
		return this;
	}
	post(path: string, handlers: Handlers) : Mousse {
		this.router.post(path, ...handlers);
		return this;
	}
	put(path: string, handlers: Handlers): Mousse {
		this.router.put(path, ...handlers);
		return this;
	}
	trace(path: string, handlers: Handlers): Mousse {
		this.router.trace(path, ...handlers);
		return this;
	}
	ws(path : string, ...handlers : Handlers) : Mousse{
		console.log("OOOK ", path);
		if (!this.#wsupgraded)
				this.wsupgrade();
			this.router.ws(path, ...handlers);
		return this;
	}

    pre(...handlers: Handlers): Mousse{
		this.router.pre(...handlers);
        return this;
    }

    last(...handlers: Handlers): Mousse{
		this.router.last(...handlers);
        return this;
	}


};