import { HTTPOptions, HTTPSOptions, Server, serve, serveTLS, mime, extname } from "./ext.ts";
import { Router } from './router.ts';
import { Context, ContextMethod, WSContext, HTTPContext , ContextHandlers, CommonContext, SSEContext } from './context.ts';
import { WebSocketPool } from './websocket.ts';
import { SSEPool } from "./serversentevent.ts";


export interface MousseOptions{
	port: number,
	hostname?: string,
	certFile?: string,
	keyFile?: string,
}

export class Mousse{
	server: Server;
  opt: MousseOptions = { port: 3000 };
	router = new Router();

	websockets: Map<string, WebSocketPool> = new Map<string, WebSocketPool>();
  sses: Map<string, SSEPool> = new Map<string, SSEPool>();
  
  started: boolean = false;
  #eventtarget: EventTarget = new EventTarget();
  #renderers: Map<string, (...obj: any) => Uint8Array | Deno.Reader | Promise<Uint8Array | Deno.Reader>> = new Map<string, (...obj: any) => Uint8Array | Deno.Reader | Promise<Uint8Array | Deno.Reader>>();
  #process?: Promise<void>;
  

  constructor(opt?: MousseOptions) {
    if (opt) {
      this.opt = opt;
    }
    if ((typeof this.opt.certFile === 'string') && (typeof this.opt.keyFile === 'string')) {
      this.server = serveTLS(this.opt as HTTPSOptions);
    }
    else {
      this.server = serve(this.opt as HTTPOptions);
    }
	}

  #start = async (): Promise<void> => {
		if (!this.started) {
			this.started = true;
      for await (const req of this.server) {
        let c = new Context(this, req)
				this.router.handle(c);
			}
		}
  }

  async start(opt? : MousseOptions) {
    if (opt) {
      this.opt = opt;
      if ((typeof this.opt.certFile === 'string') && (typeof this.opt.keyFile === 'string')) {
        this.server = serveTLS(this.opt as HTTPSOptions);
      }
      else {
        this.server = serve(this.opt as HTTPOptions);
      }
    }

    if (this.started) {
      await this.stop();
    }
    this.#process = this.#start();
  }

  async stop() {
    this.started = false;
    if (this.server) {
      this.server.close();
    }
    await this.#process;
  }

  static(path?: string, extensions?: string | Array<string>): this{
    this.router.static(path, extensions);
    return this;
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

  renderer(ext: string, renderFunction: (...obj: any) => Uint8Array | Deno.Reader | Promise<Uint8Array | Deno.Reader>) : this {
    if (!mime.getType(ext)) {
      console.error("Extension " + ext + " in app.renderer()");
      return this;
    }
    else {
      this.#renderers.set(ext, renderFunction);
      return this;
    }
  }

  async render(ext : string, data: any): Promise<Uint8Array | Deno.Reader>{
    let renderer = this.#renderers.get(ext);
    if (renderer) {
      return await renderer(data);
    }
    else {
      console.error("No renderer set for " + ext + " data");
      return new Uint8Array();
    }
  }

  on = this.#eventtarget.removeEventListener;

  off = this.#eventtarget.addEventListener;

  dispatchEvent = this.#eventtarget.dispatchEvent;
};