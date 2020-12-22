import { Status, Response, ServerRequest, mime, encode, join, v4, acceptable, acceptWebSocket, isWebSocketCloseEvent, isWebSocketPingEvent, isWebSocketPongEvent, WebSocket, WebSocketMessage } from "./ext.ts";
import { Mousse } from './mousse.ts';
import { WebSocketPool, WebSocketIDed, WebSocketEvent, WebSocketEventListener, WebSocketEventListenerObject, WebSocketTextEvent, WebSocketPingEvent, WebSocketPongEvent, WebSocketCloseEvent, WebSocketBinaryEvent } from './websocket.ts';
import { ServerSentEvent, ServerSentCloseEvent, SSEIDed, SSEPool } from './serversentevent.ts';

export type ContextMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" | "WS";

export interface StreamPool{
  sses: SSEPool;
  websockets: WebSocketPool;
}

export interface ContextHandler<T extends CommonContext = Context>{
	handle: ContextHandlerFunction<T>;
}

export type ContextHandlerFunction<T extends CommonContext = Context> = ((context: T, next?: (() => void)) => Promise<void> | void);

export function isHandler<T extends CommonContext>(obj: any): obj is ContextHandler<T> {
	return typeof obj.handle != 'undefined'; 
}

export type ContextHandlers<T extends CommonContext = Context> = Array<ContextHandler<T> | ContextHandlerFunction<T>>;

export interface CommonContext<D = any> {
  mousse: Mousse;
  id: string;
  request: ServerRequest;
  method: ContextMethod;
  params: Record<string, string>;
  url: string;
  urlpcd: string;
  data?: D;

  upgradable: boolean;
  sustainable: boolean;
  upgrade: (handler?: ContextHandlerFunction) => Promise<WSContext>;
  sustain: () => Promise<SSEContext>;
  dispatchEvent : (event: Event) => boolean | undefined;
  in: (roomname: string) => StreamPool;
  on : <T extends Event = Event>(type: string, listener: (ev: T) => void, options?: boolean | AddEventListenerOptions | undefined) => this;
  out: (type: string, listener: EventListener | EventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined) => this;
}

export interface SSEContext<D = any> extends CommonContext<D>{
  send: (data: string | Uint8Array | ServerSentEvent) => Promise<void>;
  close: (closeEvent: ServerSentCloseEvent) => Promise<void>;
  join : (roomname : string) => this;
	quit : (roomname : string) => this;
}


/**
* WebSocket Context
* Give various function to join and quit room as well as sending message to socket
*/

export interface WSContext<D = any> extends CommonContext<D>{

	websocket?: WebSocket;
  event?: WebSocketEvent;
  
	join : (roomname : string) => this;
	quit : (roomname : string) => this;
	send: (data: string | Uint8Array) => Promise<void>;
	ping: (data: string | Uint8Array) => Promise<void>;
  close: (closeEvent : WebSocketCloseEvent) => Promise<void>;
}


/**
* HTTP Context
* Give the possibility to respond, send mime file and built http response
*/

export interface HTTPContext<D = any> extends CommonContext<D>{
  response?: Response;

  respond: (res?: Response) => Promise<void>;
  
  string: (data: string, code?: Status) => this;
  json : (data: Record<string, any> | string, code?: Status) => this;
  html: (data: string, code?: Status) => this;
  blob: (data: Uint8Array | Deno.Reader, contentType?: string, code?: Status) => this;
  file: (filepath: string) => Promise<this>
}


/**
 * Real Context object 
 *
 * All context method implementations
 */

export class Context<D = any> implements WSContext<D>, HTTPContext<D>, SSEContext<D>, CommonContext<D> {
	mousse: Mousse;
	id: string;
	request: ServerRequest;
	method: ContextMethod;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
  data?: D;

  #answered: boolean = false;
  #eventtarget: EventTarget = new EventTarget();

	//HTTP Type Parameters
  response: Response & { headers: Headers } = { headers: new Headers() };

  //SSE Type Parameters
  #issse : boolean = false;

	//WS Type Parameters
  #iswebsocket: boolean = false;
	#websocket?: WebSocketIDed;

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
	in(roomname: string): StreamPool{    
    let websocketpool = this.mousse.websockets.get(roomname);
    let ssepool = this.mousse.sses.get(roomname);
    
    let websockets = websocketpool ? websocketpool.clone() : new WebSocketPool();
    let sses = ssepool ? ssepool.clone() : new SSEPool();

    return { websockets: websockets, sses: sses };
  }

  get upgradable() : boolean{
		return (!this.#issse && !this.#iswebsocket && acceptable(this.request));
  }

  get sustainable(): boolean{
    return (!this.#issse && !this.#iswebsocket);
  }

  close = async (closeEvent?: WebSocketCloseEvent | ServerSentCloseEvent) => {
    if (closeEvent) {
      this.#eventtarget.dispatchEvent(closeEvent);
    }
    else {
      this.#eventtarget.dispatchEvent(new Event("close", {cancelable : false}));
    }
      
    if (this.#iswebsocket && this.#websocket) {
      if (this.#ready !== true) {
        await this.#ready;
      }
      for (let websocketpool of this.mousse.websockets.values()) {
        websocketpool.rm(this.id);
      }
      if(!this.#websocket.websocket.isClosed)
        await this.#websocket.websocket.close(1000).catch(console.error);
      this.#iswebsocket = false;
      this.#websocket = undefined;
    }
    if (this.#issse) {
      for (let ssepool of this.mousse.sses.values()) {
        ssepool.rm(this.id);
      }
      if (this.#ready !== true) {
        await this.#ready;
      }
      await this.#prev;
      this.#issse = false;
    }
  }

  dispatchEvent(event : Event) : boolean | undefined {
    return this.#eventtarget.dispatchEvent(event);
  }

  async send(data: string | Uint8Array | ServerSentEvent) {
    if (this.#iswebsocket) {
      this.#prev = this.#websocketsend((data instanceof ServerSentEvent) ? data.data : data, this.#prev);
    }
    else if (this.#issse) {
      this.#prev = this.#ssesend((data instanceof ServerSentEvent) ? data.toString() : data, this.#prev);
    }
    else {

    }
  }

	//HTTP Type Methods
  async respond(res?: Response) {
    if (this.#iswebsocket || this.#issse) {
      console.error("Can't respond, context is pending");
      return
    }
    if (this.#answered) {
      console.error("Already respond to request");
    }
    else {
    	if (res) {
        await this.request.respond(res);
      }
      else {
        await this.request.respond(this.response);
      }
      this.#answered = true;
    }
	}
  
  string(data: string, code: Status = Status.OK): this {
    if (!this.#issse && !this.#iswebsocket) {
      this.response.headers.set("Content-Type", "text/plain");
      this.response.status = code;
      this.response.body = encode(data);
    }

    return this;
  }

  json(data: Record<string, any> | string, code: Status = Status.OK): this {
    if (!this.#issse && !this.#iswebsocket) {
      this.response.headers.set("Content-Type", "application/json");
      this.response.status = code;
      this.response.body = encode(typeof data === "object" ? JSON.stringify(data) : data);
    }

    return this;
  }

  html(data: string, code: Status = Status.OK): this {
    if (!this.#issse && !this.#iswebsocket) {
      this.response.headers.set("Content-Type", "text/html");
      this.response.status = code;
      this.response.body = encode(data);
    }
    return this;
  }


  blob(data: Uint8Array | Deno.Reader, contentType?: string, code: Status = Status.OK): this {
    if (!this.#issse && !this.#iswebsocket) {
      if (contentType) {
        this.response.headers.set("Content-Type", contentType);
      }
      this.response.status = code;
      this.response.body = data;
    }

    return this;
  }

  async file(filepath: string): Promise<this> {
    filepath = join(Deno.cwd(), filepath);
    try {
      this.blob(await Deno.readFile(filepath), mime.getType(filepath));
    } catch {
      console.error("File not found !");
    }

    return this;
  }

  //! NEED REDIRECT METHOD

  // ? Render method ??
  
  //SSE Methods
  async sustain(): Promise<SSEContext<D>>{
    if(!this.#issse && !this.#iswebsocket)
      this.#ready = this.#ssesetup();
    return this;
  }

  #ssesetup = async (): Promise<void> => {
      let headers = 'HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nCache-Control: no-cache\r\nContent-Type: text/event-stream\r\n\r\n';
      try {
        await this.request.w.write(encode(headers));
        await this.request.w.flush();
        this.#issse = true;
        this.#prev = Promise.resolve();
        this.join("");
      } catch (error) {
        console.error("Failed to keep alive : ", error);
        this.close(new ServerSentCloseEvent(401, `Failed to keep alive : ${error}`));
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
      const payload = typeof data === "string" ? encode(data) : data;
      await this.request.w.write(payload);
      await this.request.w.flush();
    } catch (error) {
      console.error("Failed to send data : ", error);
      this.close(new ServerSentCloseEvent(404, `Failed to send data : ${error}`));
    }
  };
	
  on<T extends Event = Event>(type: string, listener: (ev : T) => void , options?: boolean | AddEventListenerOptions | undefined) : this{
    this.#eventtarget.addEventListener(type, (event) => { listener(event as T);}, options);
    return this;
  }

  out(type: string, listener: WebSocketEventListenerObject | WebSocketEventListener | EventListener | EventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined) : this {
    if (listener) {
      this.#eventtarget.removeEventListener(type, listener as (EventListener | EventListenerObject | null), options);
    }
    else {
      this.#eventtarget.removeEventListener(type, (...any: any[]): any => { }, options);
    }

    return this;
  }

	//WS Type Methods
  async upgrade(handler?: ContextHandlerFunction): Promise<WSContext>{
    if(!this.#issse && !this.#iswebsocket)
      this.#ready = this.#wssetup(handler);
    return this;
  }
  
  #wssetup = async (handler?: ContextHandlerFunction): Promise<void> => {
    if (this.upgradable) {
      if (!this.#issse) {
        await this.close();
      }
			const { conn, r: bufReader, w: bufWriter, headers } = this.request;
			let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers }).catch((err) => { throw(`failed to accept websocket: ${err}`);});
      if (websocket) {
        
        this.method = "WS";
        this.#websocket = new WebSocketIDed(websocket, this.id);
        this.#iswebsocket = true;
        this.#prev = Promise.resolve();

        this.join("");

        if (handler) {
          handler(this);
          try {
            for await (const event of websocket as WebSocket) {
              if (typeof event === "string") {
                this.#eventtarget.dispatchEvent(new WebSocketTextEvent(event));
              } else if (event instanceof Uint8Array) {
                this.#eventtarget.dispatchEvent(new WebSocketBinaryEvent(event));
              } else if (isWebSocketPingEvent(event)) {
                this.#eventtarget.dispatchEvent(new WebSocketPingEvent(event[1]));
              } else if (isWebSocketPongEvent(event)) {
                this.#eventtarget.dispatchEvent(new WebSocketPongEvent(event[1]));
              } else {
                this.close(new WebSocketCloseEvent(event.code, event.reason));
              }
            }
          }
          catch (error) {
            console.error("Failed to receive frame:", error);
            this.close(new WebSocketCloseEvent(404, `Failed to receive frame : ${error}`));
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
		if (this.#iswebsocket && this.#websocket) {
			if (this.mousse.websockets.get(roomname)) {
				this.mousse.websockets.get(roomname)?.add(this.#websocket);
			}
			else {
				this.mousse.websockets.set(roomname, new WebSocketPool(this.#websocket));
			}
    }
    if (this.#issse) {
      if (this.mousse.sses.get(roomname)) {
				this.mousse.sses.get(roomname)?.add(new SSEIDed(this.request, this.id));
			}
			else {
				this.mousse.sses.set(roomname, new SSEPool(new SSEIDed(this.request, this.id)));
			}
    }
		return this;
	}

	quit(roomname : string) : this {
    if (this.#iswebsocket && this.#websocket) {
			let websocketpool = this.mousse.websockets.get(roomname);
			if (websocketpool) {
				websocketpool.rm(this.id);
				if (websocketpool.length < 1) {
					this.mousse.websockets.delete(roomname);
				}
			}
    }

    if (this.#issse) {
			let ssepool = this.mousse.sses.get(roomname);
			if (ssepool) {
				ssepool.rm(this.id);
				if (ssepool.length < 1) {
					this.mousse.sses.delete(roomname);
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
    } catch (error) {
      console.error("Failed to send data :", error);
      this.close(new WebSocketCloseEvent(404, `Failed to send data : ${error}`));
    }
  }

  async ping(data?: WebSocketMessage) {
    if(this.#iswebsocket)
		  await this.#websocket?.websocket.ping(data);
	}
}