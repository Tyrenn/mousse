//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { Context, ContextMethod, WSContext, HTTPContext , ContextHandlers, CommonContext } from './context.ts';
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

	use<T extends CommonContext = Context>(path: string, ...handlers: ContextHandlers<T>): this{
		this.router.use<T>(path, ...handlers);
		return this;
	}

	//For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
	add<T extends CommonContext = Context>(method : ContextMethod | Array<ContextMethod>, path? : string, ...handlers : ContextHandlers<T>) : this {
		this.router.add<T>(method, path, ...handlers);
		return this;
	}
	any<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		this.router.any<T>(path, ...handlers);
		return this;
	}
	delete<T extends HTTPContext = HTTPContext>(path?: string, ...handlers : ContextHandlers<T>) : this {
		this.router.delete<T>(path, ...handlers);
		return this;
	}
	get<T extends CommonContext = HTTPContext>(path?: string, ...handlers : ContextHandlers<T>) : this {
		this.router.get<T>(path, ...handlers);
		return this;
	}
	head<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>) : this {
		this.router.head<T>(path, ...handlers);
		return this;
	}
	options<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		this.router.options<T>(path, ...handlers);
		return this;
	}
	patch<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		this.router.patch<T>(path, ...handlers);
		return this;
	}
	post<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>) : this {
		this.router.post<T>(path, ...handlers);
		return this;
	}
	put<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		this.router.put<T>(path, ...handlers);
		return this;
	}
	trace<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		this.router.trace<T>(path, ...handlers);
		return this;
	}
	ws<T extends WSContext = WSContext>(path : string, ...handlers : ContextHandlers<T>) : this{
		this.router.ws<T>(path, ...handlers);
		return this;
	}
};