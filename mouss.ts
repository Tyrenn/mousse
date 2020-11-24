//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Context } from './context.ts';
//@ts-ignore
import { Handlers, MousseOptions, RequestMethod, Identifier, WebSocketMethod } from "./types.ts";
//@ts-ignore
import { isWebSocketCloseEvent, WebSocket } from 'https://deno.land/std@0.78.0/ws/mod.ts';
//@ts-ignore
import { WebsocketPool } from './websocket.ts';

export class Mouss{
	server: Server;
	router = new Router();

	websockets: WebsocketPool = new WebsocketPool();

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
			let c = new Context(this, req);

			if (c.isWSAcceptable()) {
				await c.wsAccept();
				if (c.websocket) {
					this.websockets.add(c.websocket);
					try {
						for await (const event of c.websocket) {
							c.setEvent(event);
							this.router.handle(c, () => { });
							
							if (isWebSocketCloseEvent(event)) {
								this.websockets.rm(c.websocket);
							}
						}
					}
					catch (err) {
						console.error("failed to receive frame:", err);
						if (!c.websocket.isClosed) {
							await c.websocket.close(1000).catch(console.error);
						}
						this.websockets.rm(c.websocket);
					}
				}
			}
			else {
				this.router.handle(c, () => {});
			}
		}
	}


	use(path: string, ...handlers: Handlers): Mouss{
		this.router.use(path, ...handlers);
		return this;
    }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
    add(path : string, method : (RequestMethod | WebSocketMethod) | Array<RequestMethod | WebSocketMethod>, ...handlers : Handlers) : Mouss {
		this.router.add(path, method, ...handlers);
		return this;
    }
    any(path: string, ...handlers: Handlers) : Mouss {
		this.router.any(path, ...handlers);
		return this;
	}
	
	delete(path: string, ...handlers : Handlers) : Mouss {
		this.router.delete(path, ...handlers);
		return this;
	}
	get(path: string, ...handlers : Handlers) : Mouss {
		this.router.get(path, ...handlers);
		return this;
	}
	head(path: string, ...handlers: Handlers) : Mouss {
		this.router.head(path, ...handlers);
		return this;
	}
	options(path: string, handlers: Handlers): Mouss {
		this.router.options(path, ...handlers);
		return this;
	}
	patch(path: string, handlers: Handlers): Mouss {
		this.router.patch(path, ...handlers);
		return this;
	}
	post(path: string, handlers: Handlers) : Mouss {
		this.router.post(path, ...handlers);
		return this;
	}
	put(path: string, handlers: Handlers): Mouss {
		this.router.put(path, ...handlers);
		return this;
	}
	trace(path: string, handlers: Handlers): Mouss {
		this.router.trace(path, ...handlers);
		return this;
	}
	ws(path : string, ...handlers : Handlers) : Mouss{
		this.router.ws(path, ...handlers);
		return this;
    }

	binary(path: string, ...handlers: Handlers): Mouss{
		this.router.binary(path, ...handlers);
        return this;
    }

    close(path: string, ...handlers: Handlers): Mouss{
		this.router.close(path, ...handlers);
		return this;
    }

	ping(path: string, ...handlers: Handlers): Mouss{
		this.router.ping(path, ...handlers);
        return this;
    }

    pre(...handlers: Handlers): Mouss{
		this.router.pre(...handlers);
        return this;
    }

    last(...handlers: Handlers): Mouss{
		this.router.last(...handlers);
        return this;
	}
};