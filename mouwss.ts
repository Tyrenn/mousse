//@ts-ignore
import { HTTPOptions, HTTPSOptions, Server, serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
//@ts-ignore
import { acceptable, acceptWebSocket } from "https://deno.land/std@0.78.0/ws/mod.ts";

//@ts-ignore
import { Router } from './router.ts';
//@ts-ignore
import { WSRouter } from './wsrouter.ts';
//@ts-ignore
import { Context } from './context.ts';
//@ts-ignore
import { Handlers, MoussOptions, RequestMethod } from "./types.ts";
//@ts-ignore
import { Mouss } from './mouss.ts';
//@ts-ignore
import { WSContext } from './wscontext.ts';

export class Mouwss{
  server: Server;
  router = new Router();
  wsrouter = new WSRouter();

  constructor(opt?: Mouss | MoussOptions) {
    if (opt && opt instanceof Mouss) {
      this.server = opt.server;
      this.router = opt.router;
    }
    else {
      opt = opt as MoussOptions;
      if ((typeof opt.certFile === 'string') && (typeof opt.keyFile === 'string')) {
        this.server = serveTLS(opt as HTTPSOptions);
      }
      else {
        this.server = serve(opt as HTTPOptions);
      }
    }
  }

  start = async () : Promise<void> => {
    for await (const req of this.server) {
      
      if (acceptable(req)) {
        const { conn, r: buffReader, w: buffWriter, headers } = req;
        acceptWebSocket({ conn, buffReader, buffWriter, headers })
          .then((websocket: WebSocket) => this.wsrouter.handle(new WSContext(req.url, websocket), () => { }))
          .catch(async (err : any) => {
            console.error(`failed to accept websocket: ${err}`);
            await req.respond({ status: 400 });
          });
      }
      else {
        this.router.handle(new Context(req), () => {});
      }
    }
  }

  add(path: string, method: RequestMethod, ...handlers: Handlers): Mouss {
    this.router.add(path, method, ...handlers);

    return this;
  }

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
}