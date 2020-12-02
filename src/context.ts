//@ts-ignore
import type { Response, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"
//@ts-ignore
import { acceptable, acceptWebSocket, isWebSocketCloseEvent, WebSocket, WebSocketMessage } from "https://deno.land/std@0.78.0/ws/mod.ts";
//@ts-ignore
import { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";
//@ts-ignore
import { Mousse } from './mousse.ts';
//@ts-ignore
import { WebSocketPool, WebSocketIDed, WebSocketEvent } from './websocket.ts';
//@ts-ignore
import { ServerSentEvent } from './serversentevent.ts';

export type ContextMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" | "WS" | "SSE";

export interface ContextHandler{
	handle: ContextHandlerFunction;
}

export type ContextHandlerFunction = ((context: Context, next?: (() => void)) => Promise<void> | void);

export function isHandler(obj: any): obj is ContextHandler {
	return typeof obj.handle != 'undefined'; 
}

export type ContextHandlers = Array<ContextHandler | ContextHandlerFunction>;

const sseencoder = new TextEncoder();

export interface SSEContext<D = any>{
  mousse: Mousse;
  id: string;
  request: ServerRequest;
  method: ContextMethod;
  params: Record<string, string>;
  url: string;
  urlpcd: string;
  data?: D;

  in: (roomname: string) => WebSocketPool;
  onclose: () => void;
  close: () => Promise<void>;
}

export interface WSContext<D = any>{
	mousse: Mousse;
	id: string;
	request: ServerRequest;
	method: ContextMethod;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;

	websocket?: WebSocket;
	event?: WebSocketEvent;
	
	upgradable : boolean;
	upgrade: (handler?: ContextHandlerFunction) => Promise<WSContext>;
	
	join : (roomname : string) => this;
	quit : (roomname : string) => this;
	in : (roomname : string) => WebSocketPool;
	send: (data: WebSocketMessage) => Promise<void>;
	ping: (data: WebSocketMessage) => Promise<void>;
	close: () => Promise<void>;
}

export interface HTTPContext<D = any>{
	mousse: Mousse;
	id: string;
	request: ServerRequest;
	method: ContextMethod;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;
	
	response?: Response;
	
	upgradable : boolean;
	upgrade: (handler? : ContextHandlerFunction) => Promise<WSContext>;
	
	respond: (res?: Response) => Promise<void>;
	in : (roomname : string) => WebSocketPool;
}

export class Context<D = any> implements WSContext<D>, HTTPContext<D>, SSEContext<D> {
	mousse!: Mousse;
	id: string;
	request: ServerRequest;
	method: ContextMethod;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;

	//HTTP Type Parameters
	response?: Response;

  //SSE Type Parameters
  #eventtarget?: EventTarget;
  
  #issse : boolean = false;

	//WS Type Parameters
	#websocket?: WebSocketIDed;
  #iswebsocket: boolean = false;
  event?: WebSocketEvent;

  //SSE & WS Type Parameters
  #prev = Promise.resolve();
  #ready : Promise<void> | true = true;
  

	constructor(mousse: Mousse, req: ServerRequest) {
		this.mousse = mousse;
		this.request = req;
		this.url = req.url;
		if (this.url.length > 1) {
			this.url = this.url.replace(/\/$/, '');
		}
		this.method = req.method as ContextMethod;
		this.params = {};
				this.urlpcd = "";
				this.id = v4.generate();
	}
	
	//Mutual methods
	in(roomname: string): WebSocketPool{
		let websocketpool = this.mousse.websockets.get(roomname);
		if (websocketpool) {
				return websocketpool;
		}
		else {
				return new WebSocketPool();
		}
  }

  get upgradable() : boolean{
		return (!this.#websocket && acceptable(this.request));
  }

	//HTTP Type Methods
  async respond(res?: Response) {
    if (this.#iswebsocket || this.#issse) {
      console.error("Can't respond, context is pending");
      return
    }
		if (res) {
			await this.request.respond(res);
		}
		else if(this.response) {
			await this.request.respond(this.response);
		}
		else {
			await this.request.respond({});
		}
	}
  
  async send(data: string | Uint8Array | ServerSentEvent) {
    if (this.#iswebsocket) {
      this.#prev = this.#websocketsend((data instanceof ServerSentEvent) ? data.data : data, this.#prev);
    }
    if (this.#issse) {
      this.#prev = this.#ssesend((data instanceof ServerSentEvent) ? data.toString() : data, this.#prev);
    }
  }
  
  //SSE Methods
  async keepalive(): Promise<SSEContext>{
    this.#ready = this.#ssesetup();
    return this;
  }

  #ssesetup = async (): Promise<void> => {
      let headers = 'HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nCache-Control: no-cache\r\nContent-Type: text/event-stream\r\n\r\n';
      try {
        await this.request.w.write(sseencoder.encode(headers));
        await this.request.w.flush();
        console.log("KEPTPALIVE");
        this.#eventtarget = new EventTarget();
        this.#eventtarget.addEventListener("close", this.onclose);
        this.method = "SSE";
        this.#issse = true;
        this.#prev = Promise.resolve();
      } catch (err) {
        console.error("failed to accept setup sse :", err);
        this.close();
      }
  }

  #ssesend = async (data: string | Uint8Array, prev: Promise<void>) => {
    if (!this.#issse) {
      console.error("Context is not SSE");
      return;
    }
    if (this.#ready !== true) {
      await this.#ready;
      this.#ready = true;
    }
    try {
      await prev;
      const payload = typeof data === "string" ? sseencoder.encode(data) : data;
      await this.request.w.write(payload);
      await this.request.w.flush();
    } catch (err) {
      console.error("Failed to send data :", err);
      this.close();
    }
  };
	
  on(type: string, listener: EventListener | EventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined) {
  
  }

	//WS Type Methods
	async upgrade(handler? : ContextHandlerFunction) : Promise<WSContext>{
    this.#ready = this.#wssetup(handler);
    return this;
  }
  
  #wssetup = async (handler?: ContextHandlerFunction): Promise<void> => {
    if (!this.#iswebsocket && this.upgradable) {
      if (!this.#issse) {
        await this.close();
      }
			const { conn, r: bufReader, w: bufWriter, headers } = this.request;
			let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers }).catch((err) => { throw(`failed to accept websocket: ${err}`);});
      if(websocket){
        this.method = "WS";
        this.#websocket = new WebSocketIDed(websocket, this.id);
        this.join("");
        this.event = { id: this.id };
        this.#iswebsocket = true;
        this.#prev = Promise.resolve();
        if (handler) {
          handler(this);
          try {
            for await (const event of websocket as WebSocket) {
              //Reinit context values to 
              this.urlpcd = "";
              this.event = event;

              handler(this);

              if (websocket.isClosed || isWebSocketCloseEvent(event)) {
                this.close();
              }
            }
          }
          catch (err) {
            console.error("Failed to receive frame:", err);
            this.close();
          }
        }
			}
    }
    else {
      console.error("Context is not acceptable");
    }
  } 

  get websocket(): WebSocket | undefined{
    if (this.#iswebsocket) {
      return this.#websocket?.websocket;
    }
    else {
      return undefined;
    }
	}

	join(roomname: string): this{
		if (this.#iswebsocket && this.#websocket && this.mousse.websockets) {
			if (this.mousse.websockets.get(roomname)) {
				this.mousse.websockets.get(roomname)?.add(this.#websocket);
				console.log(this.mousse.websockets);
			}
			else {
				this.mousse.websockets.set(roomname, new WebSocketPool(this.#websocket));
			}
		}
		return this;
	}

	quit(roomname : string) : this {
		if (this.#iswebsocket && this.#websocket) {
			let websocketpool = this.mousse.websockets.get(roomname);
			if (websocketpool) {
				websocketpool.rm(this.#websocket);
				if (websocketpool.length < 1) {
					this.mousse.websockets.delete(roomname);
				}
			}
		}
		return this;
	}
  
  #websocketsend = async (data: string | Uint8Array, prev: Promise<void>) => {
    if (!this.#iswebsocket) {
      return;
    }
    if (this.#ready !== true) {
      await this.#ready;
      this.#ready = true;
    }
    try {
      await prev;
      await this.#websocket?.websocket.send(data);
    } catch (err) {
      console.error("Failed to send data :", err);
      this.close();
    }
  }

  async ping(data?: WebSocketMessage) {
    if(this.#iswebsocket)
		  await this.#websocket?.websocket.ping(data);
	}

  close = async () => {
    if (this.#iswebsocket && this.#websocket) {
      for (let websocketpool of this.mousse.websockets.values()) {
        websocketpool.rm(this.#websocket);
      }
      if(!this.#websocket.websocket.isClosed)
        await this.#websocket.websocket.close(1000).catch(console.error);
      this.#iswebsocket = false;
      this.#websocket = undefined;
    }
    if (this.#issse) {
      if (this.#ready !== true) {
        await this.#ready;
      }
      await this.#prev;
      this.#eventtarget?.dispatchEvent(new Event("close", {cancelable : false}));
    }
	}
}