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

export type ContextMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" | "WS";

export interface ContextHandler{
	handle: ContextHandlerFunction;
}

export type ContextHandlerFunction = ((context: Context, next?: (() => void)) => Promise<void> | void);

export function isHandler(obj: any): obj is ContextHandler {
	return typeof obj.handle != 'undefined'; 
}

export type ContextHandlers = Array<ContextHandler | ContextHandlerFunction>;

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
  end: () => Promise<void>;
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
	
	wsUpgradable : boolean;
	wsupgrade: (handler?: ContextHandlerFunction) => Promise<WSContext>;
	
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
	
	wsUpgradable : boolean;
	wsupgrade: (handler? : ContextHandlerFunction) => Promise<WSContext>;
	
	respond: (res?: Response) => Promise<void>;
	in : (roomname : string) => WebSocketPool;
}

export class Context <D = any> implements WSContext< D >, HTTPContext< D > {
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

	//WS Type Parameters
	#websocket?: WebSocketIDed;
		event?: WebSocketEvent;

	constructor(mousse: Mousse, req: ServerRequest) {
		this.mousse = mousse;
		this.request = req;
		this.url = req.url;
		if (this.url.length > 1) {
			//delete first slash
			this.url = this.url.replace(/^\//, '');
			//delete last slash
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

	//HTTP Type Methods
	async respond(res?: Response) {
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
	
	get wsUpgradable() : boolean{
		return (this.method == "GET" && !this.#websocket && acceptable(this.request));
	}
	
	//WS Type Methods
	async wsupgrade(handler? : ContextHandlerFunction) : Promise<WSContext>{
		if (this.wsUpgradable) {
			const { conn, r: bufReader, w: bufWriter, headers } = this.request;
			let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers }).catch((err) => { throw(`failed to accept websocket: ${err}`);});
      if(websocket){
        this.method = "WS";
        this.#websocket = new WebSocketIDed(websocket, this.id);
        this.join("");
        this.event = { id: this.id };
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

		return this;
	}

	get websocket(): WebSocket | undefined{
		return this.#websocket?.websocket;
	}

	join(roomname: string): this{
		if (this.#websocket && this.mousse.websockets) {
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
		if (this.#websocket) {
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

  async send(data: WebSocketMessage) {
    //console.log("IN SEND  : ", data);
    //console.log("IN SEND  : ",this.#websocket )
		await this.#websocket?.websocket.send(data);
	}

	async ping(data?: WebSocketMessage) {
		await this.#websocket?.websocket.ping(data);
	}

	async close() {
		console.trace("IN CLOSING");
			if (this.#websocket && !this.#websocket.websocket.isClosed) {
				for (let websocketpool of this.mousse.websockets.values()) {
					websocketpool.rm(this.#websocket);
				}
				await this.#websocket.websocket.close(1000).catch(console.error);
			}
		}
}