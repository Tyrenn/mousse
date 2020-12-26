import { Status, Response, ServerRequest, mime, encode, join, v4, acceptable, extname, getCookies, setCookie, Cookie, Cookies,  acceptWebSocket, isWebSocketCloseEvent, isWebSocketPingEvent, isWebSocketPongEvent, WebSocket, WebSocketMessage } from "./ext.ts";
import { Mousse } from './mousse.ts';
import { WebSocketPool, WebSocketIDed, WebSocketEvent, WebSocketEventListener, WebSocketEventListenerObject, WebSocketTextEvent, WebSocketPingEvent, WebSocketPongEvent, WebSocketCloseEvent, WebSocketBinaryEvent } from './websocket.ts';
import { ServerSentEvent, ServerSentCloseEvent, SSEIDed, SSEPool } from './serversentevent.ts';

export type HTTPContextMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";
export type WSContextMethod = "WS";
export type SSEContextMethod = "SSE";
export type ContextMethod = HTTPContextMethod | WSContextMethod | SSEContextMethod;

export function isHTTPContextMethod(obj: string | ContextMethod): obj is HTTPContextMethod {
	return (obj === "DELETE" || obj === "GET" || obj === "HEAD" || obj === "OPTIONS" || obj === "PATCH" || obj === "POST" || obj === "PUT" || obj === "TRACE");
}

export interface StreamPool{
  sses: SSEPool;
  websockets: WebSocketPool;
}

export interface ContextHandler<T extends CommonContext = Context>{
	handle: ContextHandlerFunction<T>;
}

export type ContextHandlerFunction<T extends CommonContext = Context> = ((context: T, next?: (() => void | Promise<void>)) => Promise<void> | void);

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
  readonly cookies: Cookies;
  
  upgradable: boolean;
  sustainable: boolean;
  upgrade: (handler?: ContextHandlerFunction) => Promise<WSContext>;
  sustain: () => Promise<SSEContext>;
  dispatchEvent : (event: Event) => boolean | undefined;
  in: (roomname: string) => StreamPool;
  on : <T extends Event = Event>(type: string, listener: (ev: T) => void, options?: boolean | AddEventListenerOptions | undefined) => this;
  off: (type: string, listener: EventListener | EventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined) => this;
  setCookie: (c: Cookie) => this;
}

export interface SSEContext<D = any> extends CommonContext<D>{
  send: (data: string | Uint8Array | ServerSentEvent) => Promise<this>;
  close: (closeEvent: ServerSentCloseEvent) => Promise<this>;
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
	send: (data: string | Uint8Array) => Promise<this>;
	ping: (data: string | Uint8Array) => Promise<this>;
  close: (closeEvent : WebSocketCloseEvent) => Promise<this>;
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
  file: (filepath: string) => Promise<this>;
  renderFile : (filepath: string) => Promise<this>;
  render: (ext : string, data : any) => Promise<this>;
  redirect: (url: string, code?: Status) => Promise<void>;
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

  answered: boolean = false;
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
		return (!this.answered && !this.#issse && !this.#iswebsocket && acceptable(this.request));
  }

  get sustainable(): boolean{
    return (!this.answered && !this.#issse && !this.#iswebsocket && this.request.headers.has("accept") && this.request.headers.get("accept") === "text/event-stream");
  }

  close = async (closeEvent?: WebSocketCloseEvent | ServerSentCloseEvent) : Promise<this> => {
    if (closeEvent) {
      this.#eventtarget.dispatchEvent(closeEvent);
    }
    else {
      this.#eventtarget.dispatchEvent(new Event("close", {cancelable : false}));
    }
      
    if (this.#iswebsocket && this.#websocket) {
      if (this.#ready !== true) {
        await this.#ready;
        this.#ready = true;
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
        this.#ready = true;
      }
      await this.#prev;
      this.#issse = false;
    }

    return this;
  }

  dispatchEvent(event : Event) : boolean | undefined {
    return this.#eventtarget.dispatchEvent(event);
  }

  async send(data: string | Uint8Array | ServerSentEvent): Promise<this> {
    console.log(this.#issse)
    if (this.#iswebsocket) {
      this.#prev = this.#websocketsend((data instanceof ServerSentEvent) ? data.data : data, this.#prev);
      await this.#prev;
    }
    else if (this.#issse) {
      this.#prev = this.#ssesend((data instanceof ServerSentEvent) ? data.toString() : data, this.#prev);
      await this.#prev;
    }
    else {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Context not upgraded or sustained" }));
    }

    return this;
  }

  get cookies(): Cookies {
    return getCookies(this.request);
  }

  setCookie(c: Cookie): this {
    setCookie(this.response, c);
    return this;
  }

	//HTTP Type Methods
  async respond(res?: Response) {
    if (this.#iswebsocket || this.#issse) {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Context can't respond, context is pending" }));
      return
    }
    if (this.answered) {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Context has already answered to request" }));
    }
    else {
    	if (res) {
        await this.request.respond(res);
      }
      else {
        await this.request.respond(this.response);
      }
      this.answered = true;
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
      this.blob(await Deno.readFile(filepath), this.mousse.opt.mime?.getType(filepath));
    } catch {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "File not found : " + filepath }));
    }

    return this;
  }

  async renderFile(filepath: string): Promise<this>{
    let ext = this.mousse.opt.mime?.getType(filepath) ? extname(filepath) : undefined;
    if (ext) {
      try {
        this.blob(await this.mousse.render(ext, await Deno.readFile(filepath)), "text/html");
      } catch {
        this.mousse.dispatchEvent(new ErrorEvent("error", { message: "File not found : " + filepath }));
      }
    }
    else
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Unkown " + ext + " extension type in set Mime object" }));

    return this;  
  }

  async render(ext: string, data: any): Promise<this>{
    if (this.mousse.opt.mime?.getType(ext)) {
      this.blob(await this.mousse.render(ext, data), "text/html");
    }
    else
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Unkown " + ext + " extension type in set Mime object" }));
    return this;
  }

  async redirect(url: string, code: Status = Status.Found) : Promise<void> {
    this.response.headers.set("Location", url);
    this.response.status = code;
    await this.respond();
  }
  
  //SSE Methods
  async sustain(): Promise<SSEContext<D>>{
    if (!this.answered && !this.#issse && !this.#iswebsocket) {
      this.#ready = this.#ssesetup();
      await this.#ready;
      this.answered = true;
      this.#ready = true;
    }
    return this;
  }

  #ssesetup = async (): Promise<void> => {
      let headers = 'HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nCache-Control: no-cache\r\nContent-Type: text/event-stream\r\n\r\n';
      try {
        await this.request.w.write(encode(headers));
        await this.request.w.flush();
        this.#issse = true;
        this.#prev = Promise.resolve();
        this.#eventtarget.addEventListener("close", () => { console.log("AHHHH CLOSE") });
        this.join("");
      } catch (error) {
        this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Failed to keep alive", error : error }));
        this.close(new ServerSentCloseEvent(401, `Failed to keep alive : ${error}`));
      }
  }

  #ssesend = async (data: string | Uint8Array, prev: Promise<void>) => {
    if (!this.#issse) {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Context is not SSE" }));
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
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Failed to send data", error : error }));
      this.close(new ServerSentCloseEvent(404, `Failed to send data : ${error}`));
    }
  };
	
  on<T extends Event = Event>(type: string, listener: (ev : T) => void , options?: boolean | AddEventListenerOptions | undefined) : this{
    this.#eventtarget.addEventListener(type, (event) => { listener(event as T);}, options);
    return this;
  }

  off(type: string, listener: WebSocketEventListenerObject | WebSocketEventListener | EventListener | EventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined) : this {
    if (listener) {
      this.#eventtarget.removeEventListener(type, listener as (EventListener | EventListenerObject | null), options);
    }
    else {
      this.#eventtarget.removeEventListener(type, (...any: any[]): any => { }, options);
    }

    return this;
  }

	//WS Type Methods
  async upgrade(): Promise<WSContext>{
    if (!this.answered && !this.#issse && !this.#iswebsocket) {
      this.#ready = this.#wssetup();
      await this.#ready;
      this.answered = true;
      this.#ready = true;
    }
    return this;
  }
  
  #wsloop = async () => {
    try {
    for await (const event of this.websocket as WebSocket) {
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
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Failed to receive frame", error : error }));
      this.close(new WebSocketCloseEvent(404, `Failed to receive frame : ${error}`));
    }
  }

  #wssetup = async (): Promise<void> => {
    if (this.upgradable) {
      if (!this.#issse) {
        await this.close();
      }
			const { conn, r: bufReader, w: bufWriter, headers } = this.request;
			let websocket = await acceptWebSocket({ conn, bufReader, bufWriter, headers }).catch((err) => { throw(`failed to accept websocket: ${err}`);});
      if (websocket) {
        this.#websocket = new WebSocketIDed(websocket, this.id);
        this.#iswebsocket = true;
        this.#prev = Promise.resolve();

        this.join("");
        this.#wsloop();
			}
    }
    else {
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Context is not acceptable" }));
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
      this.mousse.dispatchEvent(new ErrorEvent("error", { message: "Failed to send data", error : error }));
      this.close(new WebSocketCloseEvent(404, `Failed to send data : ${error}`));
    }
  }

  async ping(data?: WebSocketMessage) : Promise<this> {
    if(this.#iswebsocket)
		  await this.#websocket?.websocket.ping(data);
  
    return this;
  }
}