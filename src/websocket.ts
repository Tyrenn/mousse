import { isWebSocketCloseEvent, WebSocket, WebSocketMessage, v4 } from './ext.ts';

export type Identifier = { id: string }

/*
export type WebSocketEvent =
	|	string
	|	Uint8Array
	|	WebSocketCloseEvent 
	|	WebSocketPingEvent
	|	WebSocketPongEvent	
	|	WebSocketConnectEvent
*/

export type WebSocketEvent = Event | WebSocketTextEvent | WebSocketBinaryEvent | WebSocketCloseEvent | WebSocketPingEvent | WebSocketPongEvent;

export type WebSocketEventListener = WebSocketBinaryEventListener | WebSocketTextEventListener;

export type WebSocketEventListenerObject = WebSocketBinaryEventListenerObject | WebSocketTextEventListenerObject;

export interface WebSocketBinaryEventListener {
  (event: WebSocketBinaryEvent): void | Promise<void>;
}

export interface WebSocketBinaryEventListenerObject {
  handleEvent(evt: WebSocketBinaryEvent): void | Promise<void>;
}

export interface WebSocketTextEventListener{
  (event: WebSocketTextEvent): void | Promise<void>;
}

export interface WebSocketTextEventListenerObject {
  handleEvent(evt: WebSocketTextEvent): void | Promise<void>;
}

export class WebSocketTextEvent extends Event{
  readonly data: string;

  constructor(data: string, eventInit? : EventInit) {
    super("text", eventInit);
    this.data = data;
  }
}

export class WebSocketBinaryEvent extends Event{
  readonly data : Uint8Array;

  constructor(data: Uint8Array, eventInit? : EventInit) {
    super("binary", eventInit);
    this.data = data;
  }
}

export class WebSocketCloseEvent extends Event{
  readonly code: number;
  readonly reason?: string;

  constructor(code: number, reason?:string, eventInit? : EventInit) {
    super("close", eventInit);
    this.code = code;
    this.reason = reason;
  }
}

export class WebSocketPingEvent extends Event{
  readonly data: Uint8Array;

  constructor(data: Uint8Array, eventInit?: EventInit) {
    super("ping", eventInit);
    this.data = data;
  }
}

export class WebSocketPongEvent extends Event{
  readonly data: Uint8Array;

  constructor(data: Uint8Array, eventInit?: EventInit) {
    super("pong", eventInit);
    this.data = data;
  }
}

export class WebSocketIDed implements Identifier{
	websocket: WebSocket;
	id: string;

	constructor(websocket: WebSocket, id?: string) {
		this.websocket = websocket;
		if (id) {
			this.id = id;
		}
		else{
			this.id = v4.generate();
		}
	}
}

export class WebSocketPool{

	#websockets: Array<WebSocketIDed>;

	constructor(...websockets: Array<WebSocketIDed>) {
		this.#websockets = websockets;
	}

  clone(): WebSocketPool{
    return new WebSocketPool(...this.#websockets);
  }

	add(ws: WebSocketIDed) {
		if (!this.has(ws))
			this.#websockets.push(ws);
	}

	rm(ws: Identifier | string) {
		let index : number = -1;
		if (typeof ws === "string") {
			index = this.#websockets.findIndex((socket) => socket.id == ws)

		}
		else {
			index = this.#websockets.findIndex((socket) => socket.id == ws.id)
		}
		if(index > -1)
			this.#websockets.splice(index,1);
	}

	get length(): number{
		return this.#websockets.length;
	}

	has(ws: Identifier | string): boolean {
		if (typeof ws === "string") {
			return (this.#websockets.findIndex((socket) => socket.id == ws)) > -1;
		}
		else {
			return (this.#websockets.findIndex((socket) => socket.id == ws.id)) > -1;
		}
		
	}

	async broadcast(data : WebSocketMessage) {
		for (let ws of this.#websockets) {
			await ws.websocket.send(data);
		}
	}
	
	async send(ws: Identifier | string, data: WebSocketMessage) {
		let index: number = -1;
		if (typeof ws === "string") {
			index = this.#websockets.findIndex((socket) => socket.id == ws)
		}
		else {
			index = this.#websockets.findIndex((socket) => socket.id == ws.id)
		}
		if (index > -1)
			await this.#websockets[index].websocket.send(data);
	}
}