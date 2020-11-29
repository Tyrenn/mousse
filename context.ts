//@ts-ignore
import type { Response, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"
//@ts-ignore
import { WebSocket, WebSocketMessage } from "https://deno.land/std@0.78.0/ws/mod.ts";
//@ts-ignore
import { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";
//@ts-ignore
import { Mousse } from './mousse.ts';
//@ts-ignore
import { Method, WebSocketEvent } from './types.ts';
//@ts-ignore
import { WebSocketPool, WebSocketIDed } from './websocket.ts';


export interface WSContext<D = any>{
	mousse: Mousse;
	id: string;
	request: ServerRequest;
	method: Method;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;

	websocket?: WebSocket;
	event?: WebSocketEvent;
	
	join : (roomname : string) => WSContext;
	quit : (roomname : string) => WSContext;
	in : (roomname : string) => WebSocketPool;
	send: (data: WebSocketMessage) => Promise<void>;
	ping: (data: WebSocketMessage) => Promise<void>;
	close: () => Promise<void>;
}

export interface HTTPContext<D = any>{
	mousse: Mousse;
	id: string;
	request: ServerRequest;
	method: Method;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;
	
	response?: WebSocket;
	
	respond: (res?: Response) => void;
	in : (roomname : string) => WebSocketPool;
}

export class Context <D = any> implements WSContext< D > {
	mousse!: Mousse;
	id: string;
	request: ServerRequest;
	method: Method;
	params: Record<string, string>;
	url: string;
	urlpcd: string;
	data?: D;

	//HTTP Type Parameters
	response?: Response;

	//WS Type Parameters
	#websocket?: WebSocketIDed;
    event?: WebSocketEvent;

	constructor(mousse: Mousse, req: ServerRequest, method : Method) {
        this.mousse = mousse;
		this.request = req;
		this.url = req.url;
		if (this.url.length > 1) {
			//delete first slash
			this.url = this.url.replace(/^\//, '');
			//delete last slash
			this.url = this.url.replace(/\/$/, '');
		}
		this.method = method;
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
	respond(res?: Response) {
        if (res) {
            this.request.respond(res);
        }
        else if(this.response) {
            this.request.respond(this.response);
        }
        else {
            this.request.respond({});
        }
	}
	

	//WS Type Methods
	upgrade(websocket : WebSocket) {
		if (!this.#websocket) {
			this.#websocket = new WebSocketIDed(websocket, this.id);
			this.join("");
		}
	}

	get websocket(): WebSocket | undefined{
        return this.#websocket?.websocket;
    }

	join(roomname: string): Context{
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

    quit(roomname : string) : Context {
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
        this.#websocket?.websocket.send(data);
    }

    async ping(data?: WebSocketMessage) {
		this.#websocket?.websocket.ping(data);
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