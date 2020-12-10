//@ts-ignore
import type { HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { Context, ContextMethod, WSContext, HTTPContext , ContextHandlers, CommonContext, SSEContext } from './context.ts';
//@ts-ignore
import { WebSocketPool } from './websocket.ts';
//@ts-ignore
import { SSEPool } from "./serversentevent.ts";


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
  sses: Map<string, SSEPool> = new Map<string, SSEPool>();
  
  started: boolean = false;
  //? Thinking of an ERROR HANDLING
  #eventtarget: EventTarget = new EventTarget();

	//start: () => Promise<void>;

	constructor(opt: MousseOptions) {
		this.opt = opt;
		if ((typeof opt.certFile === 'string') && (typeof opt.keyFile === 'string')) {
			this.server = serveTLS(opt as HTTPSOptions);
		}
		else {
			this.server = serve(opt as HTTPOptions);
		}
	}

  async start() {
		if (!this.started) {
			this.started = true;
      for await (const req of this.server) {
        let c = new Context(this, req)
				this.router.handle(c);
			}
		}
  }
  
  async close(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

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
  
  sse<T extends SSEContext = SSEContext>(path?: string, ...handlers: ContextHandlers<T>): this {
    this.router.sse<T>(path, ...handlers);
    return this;
  }
};