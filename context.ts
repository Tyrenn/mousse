//@ts-ignore
import type { Response, Server, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"
//@ts-ignore
import { acceptable, acceptWebSocket, isWebSocketCloseEvent, WebSocket, WebSocketEvent, WebSocketMessage } from "https://deno.land/std@0.78.0/ws/mod.ts";
//@ts-ignore
import { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";
//@ts-ignore
import { Mousse } from './mousse.ts';
//@ts-ignore
import { Method, HandlerFunction } from './types.ts';
//@ts-ignore
import { WebSocketPool, WebSocketIDed } from './websocket.ts';

/*
class Context<D = any>{

    mousse: Mousse;
    id: string;

    method : Method;

    request: ServerRequest;
    response?: Response;

    #websocket?: WebSocketIDed;
    #wsevent?: WebSocketEvent;

    params : Record<string, string>;
    processedUrl: string;
    data?: D;

    constructor(mousse: Mousse, req: ServerRequest) {
        this.mousse = mousse;
        this.request = req;
        this.method = <Method> req.method;
        this.params = {};
        this.processedUrl = "";
        this.id = v4.generate();
    }

    get websocket(): WebSocket | undefined{
        return this.#websocket?.websocket;
    }

    get wsevent(): WebSocketEvent | undefined{
        return this.#wsevent;
    }
    
    get isWSAccepted() {
        return this.#websocket && this.#wsevent;
    }

    respond(res?: Response) {
        if (this.#websocket) {
            throw ("Request is a websocket and can't be answered");
        }
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

    join(roomname: string): Context{
        if (this.#websocket && this.mousse.websockets) {
            let websocketpool = this.mousse.websockets.get(roomname);
            if (websocketpool) {
                websocketpool.add(this.#websocket); 
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

    in(roomname: string): WebSocketPool{
        let websocketpool = this.mousse.websockets.get(roomname);
        if (websocketpool) {
            return websocketpool;
        }
        else {
            return new WebSocketPool();
        }
    }

    get broadcast(): WebSocketPool{
        let websocketpool = this.mousse.websockets.get("");
        if (websocketpool) {
            return websocketpool;
        }
        else {
            return new WebSocketPool();
        }
    }

    async send(data: WebSocketMessage) {
        this.#websocket?.websocket.send(data);
    }

    async ping(data?: WebSocketMessage) {
        this.#websocket?.websocket.ping(data);
    }


    async close() {
        if (this.#websocket && !this.#websocket.websocket.isClosed) {
            for (let websocketpool of this.mousse.websockets.values()) {
                websocketpool.rm(this.#websocket);
            }
            await this.#websocket.websocket.close(1000).catch(console.error);
            this.#websocket = undefined;
        }
    }

    isWSAcceptable(): boolean {
        return !this.isWSAccepted && this.request.method == "GET" && acceptable(this.request);
    }

    async wsAccept(fn?: HandlerFunction, next?: () => void): Promise<void> {
		console.log("In context accept");
        if (!this.isWSAccepted && this.request.method == "GET" && acceptable(this.request)) {
            const { conn, r: bufReader, w: bufWriter, headers } = this.request;
            
            this.#websocket = new WebSocketIDed(await acceptWebSocket({ conn, bufReader, bufWriter, headers }), this.id);
            this.join("");

			if (fn) {
				console.log("passé OOK ");
                try {
                    for await (const event of this.#websocket.websocket) {
                        this.#wsevent = event;
                        this.method = "WS";
						
                        await fn(this, next);

                        if (isWebSocketCloseEvent(event)) {
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

    //TODO : add helpers for response : cookies, contenttype, renderer ?
}*/


export class Context <D = any> {
	mousse: Mousse;
    id: string;
	request: ServerRequest;
	method: Method;
	params : Record<string, string>;
    processedUrl: string;
	
	data?: D;

	constructor(mousse: Mousse, req: ServerRequest, method : Method) {
        this.mousse = mousse;
		this.request = req;
		this.method = method;
		this.params = {};
        this.processedUrl = "";
        this.id = v4.generate();
    }
}

export class HTTPContext<D = any> extends Context<D>{

	response: Response;

	constructor(mousse: Mousse, req: ServerRequest) {
		super(mousse, req, <Method> req.method);
		this.response = {};
	}

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
}

export class WSContext<D = any> extends Context<D>{

    #websocket: WebSocketIDed;
    event?: WebSocketEvent;

	constructor(mousse: Mousse, req: ServerRequest, websocket : WebSocket) {
		super(mousse, req, "WS");
		this.#websocket = new WebSocketIDed(websocket, this.id);
		this.join("");
	}

    get websocket(): WebSocket | undefined{
        return this.#websocket?.websocket;
    }

	join(roomname: string): Context{
        if (this.#websocket && this.mousse.websockets) {
            let websocketpool = this.mousse.websockets.get(roomname);
            if (websocketpool) {
                websocketpool.add(this.#websocket); 
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

    in(roomname: string): WebSocketPool{
        let websocketpool = this.mousse.websockets.get(roomname);
        if (websocketpool) {
            return websocketpool;
        }
        else {
            return new WebSocketPool();
        }
    }

    get broadcast(): WebSocketPool{
        let websocketpool = this.mousse.websockets.get("");
        if (websocketpool) {
            return websocketpool;
        }
        else {
            return new WebSocketPool();
        }
    }

    async send(data: WebSocketMessage) {
        this.#websocket.websocket.send(data);
    }

    async ping(data?: WebSocketMessage) {
        this.#websocket.websocket.ping(data);
    }

    async close() {
        if (this.#websocket && !this.#websocket.websocket.isClosed) {
            for (let websocketpool of this.mousse.websockets.values()) {
                websocketpool.rm(this.#websocket);
            }
            await this.#websocket.websocket.close(1000).catch(console.error);
        }
    }
}