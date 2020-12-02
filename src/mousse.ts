//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { Context, ContextMethod, ContextHandlers } from './context.ts';
//@ts-ignore
import { WebSocketPool } from './websocket.ts';
//@ts-ignore
import { acceptWebSocket, acceptable, isWebSocketCloseEvent, WebSocket } from 'https://deno.land/std@0.78.0/ws/mod.ts';

export interface MousseOptions{
	port: number,
	hostname?: string,
	certFile?: string,
	keyFile?: string,
}

export class Mousse{
	server: Server;
	opt: MousseOptions;
	router = new Router();

	websockets: Map<string, WebSocketPool> = new Map<string, WebSocketPool>();

	//#wsupgraded: boolean = false;
	started: boolean = false;

	//start: () => Promise<void>;

	constructor(opt: MousseOptions) {
		this.opt = opt;
		if ((typeof opt.certFile === 'string') && (typeof opt.keyFile === 'string')) {
			this.server = serveTLS(opt as HTTPSOptions);
		}
		else {
			this.server = serve(opt as HTTPOptions);
		}
		//this.start = this.startNoWS;
	}
/*
	private async startWS() {
		if (!this.started) {
			this.started = true;
			for await (const req of this.server) {
				let context = new Context(this, req);
				if (context.wsUpgradable()) {
					context.wsupgrade(this.handleWS);
				}
				else {
					this.router.handle(new Context(this, req), () => { });
				}
			}
		}
	}

	private async startNoWS() {
		if (!this.started) {
			this.started = true;
			for await (const req of this.server) {
				this.router.handle(new Context(this, req), () => {});
			}
		}
	}
  */

  async start() {
		if (!this.started) {
			this.started = true;
      for await (const req of this.server) {
        console.log("\n\n-----\n");
        let c = new Context(this, req)
        console.log(c.method, c.url);
				this.router.handle(c);
			}
		}
	}
/*
	private wsupgrade(): void {
		if (!this.#wsupgraded) {
			this.#wsupgraded = true;
			this.start = this.startWS;	
		}
	}*/

	use(path: string, ...handlers: ContextHandlers): this{
		this.router.use(path, ...handlers);
		return this;
	}

	//For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
	add(method : ContextMethod | Array<ContextMethod>, path? : string, ...handlers : ContextHandlers) : this {
		this.router.add(method, path, ...handlers);
		return this;
	}
	
	any(path?: string, ...handlers: ContextHandlers): this {
		this.router.any(path, ...handlers);
		return this;
	}
	
	delete(path?: string, ...handlers : ContextHandlers) : this {
		this.router.delete(path, ...handlers);
		return this;
	}
	get(path?: string, ...handlers : ContextHandlers) : this {
		this.router.get(path, ...handlers);
		return this;
	}
	head(path?: string, ...handlers: ContextHandlers) : this {
		this.router.head(path, ...handlers);
		return this;
	}
	options(path?: string, ...handlers: ContextHandlers): this {
		this.router.options(path, ...handlers);
		return this;
	}
	patch(path?: string, ...handlers: ContextHandlers): this {
		this.router.patch(path, ...handlers);
		return this;
	}
	post(path?: string, ...handlers: ContextHandlers) : this {
		this.router.post(path, ...handlers);
		return this;
	}
	put(path?: string, ...handlers: ContextHandlers): this {
		this.router.put(path, ...handlers);
		return this;
	}
	trace(path?: string, ...handlers: ContextHandlers): this {
		this.router.trace(path, ...handlers);
		return this;
	}
	ws(path : string, ...handlers : ContextHandlers) : this{
		this.router.ws(path, ...handlers);
		return this;
	}
};