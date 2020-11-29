//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { Context } from './context.ts';
//@ts-ignore
import { Handlers, MousseOptions, Method, WebSocketEvent, HTTPHandlers} from "./types.ts";
//@ts-ignore
import { WebSocketPool } from './websocket.ts';
//@ts-ignore
import { acceptWebSocket, acceptable, isWebSocketCloseEvent } from 'https://deno.land/std@0.78.0/ws/mod.ts';
//@ts-ignore
import { ServerRequest } from 'https://deno.land/std@0.78.0/http/server.ts';

export class Mousse{
	server: Server;
	opt: MousseOptions;
	router = new Router();

	websockets: Map<string, WebSocketPool> = new Map<string, WebSocketPool>();

	#wsupgraded: boolean = false;
	started: boolean = false;

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

	private async handleWS(req : ServerRequest) {
		console.log("Acceptable");
		const { conn, r: bufReader, w: bufWriter, headers } = req;
		let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers });
		let context = new Context(this, req, "WS");
		context.upgrade(websocket);
		context.event = { id: context.id };
		await this.router.handle(context);
		try {
			for await (const event of websocket) {
				//Reinit context values to 
				context.urlpcd = "";
				context.event = event;

				this.router.handle(context);

				if (websocket.isClosed || isWebSocketCloseEvent(event)) {
					context.close();
				}
			}
		}
		catch (err) {
			console.error("Failed to receive frame:", err);
			context.close();
		}
	}

	private async startWS() {
		if (!this.started) {
			this.started = true;
			for await (const req of this.server) {
				if (acceptable(req)) {
					this.handleWS(req);
				}
				else {
					this.router.handle(new Context(this, req, <Method> req.method), () => {});
				}
			}	
		}
	}

	private async startNoWS() {
		if (!this.started) {
			this.started = true;
			for await (const req of this.server) {
				this.router.handle(new Context(this, req, <Method> req.method), () => {});
			}
		}
	}

	private wsupgrade(): void {
		if (!this.#wsupgraded) {
			this.#wsupgraded = true;
			this.start = this.startWS;	
		}
	}

	use(path: string, ...handlers: HTTPHandlers): this{
		this.router.use(path, ...handlers);
		return this;
  }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
  add(method : Method | Array<Method>, path? : string, ...handlers : Handlers) : this {
		this.router.add(method, path, ...handlers);
		return this;
  }
  
  any(path?: string, ...handlers: HTTPHandlers): this {
		this.router.any(path, ...handlers);
		return this;
	}
	
	delete(path?: string, ...handlers : HTTPHandlers) : this {
		this.router.delete(path, ...handlers);
		return this;
	}
	get(path?: string, ...handlers : HTTPHandlers) : this {
		this.router.get(path, ...handlers);
		return this;
	}
	head(path?: string, ...handlers: HTTPHandlers) : this {
		this.router.head(path, ...handlers);
		return this;
	}
	options(path?: string, ...handlers: HTTPHandlers): this {
		this.router.options(path, ...handlers);
		return this;
	}
	patch(path?: string, ...handlers: HTTPHandlers): this {
		this.router.patch(path, ...handlers);
		return this;
	}
	post(path?: string, ...handlers: HTTPHandlers) : this {
		this.router.post(path, ...handlers);
		return this;
	}
	put(path?: string, ...handlers: HTTPHandlers): this {
		this.router.put(path, ...handlers);
		return this;
	}
	trace(path?: string, ...handlers: HTTPHandlers): this {
		this.router.trace(path, ...handlers);
		return this;
	}
	ws(path : string, ...handlers : HTTPHandlers) : this{
		if (!this.#wsupgraded)
			this.wsupgrade();
		this.router.ws(path, ...handlers);
		return this;
	}

  pre(...handlers: HTTPHandlers): this{
		this.router.pre(...handlers);
        return this;
  }

  last(...handlers: HTTPHandlers): this{
		this.router.last(...handlers);
        return this;
	}
};