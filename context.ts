//@ts-ignore
import type { Response, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"
//@ts-ignore
import { acceptable, acceptWebSocket, isWebSocketCloseEvent, isWebSocketPingEvent, WebSocket, WebSocketEvent } from "https://deno.land/std@0.78.0/ws/mod.ts";
//@ts-ignore
import { BufReader, BufWriter } from "https://deno.land/std@0.78.0/io/bufio.ts";
//@ts-ignore
import { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";
//@ts-ignore
import { Mouss } from './mouss.ts';
//@ts-ignore
import { WebSocketMethod, RequestMethod, Identifier } from './types.ts';
//@ts-ignore
import { WebSocketPool } from './websocket.ts';

export class Context<T = any>{

    mouss: Mouss;
    method : WebSocketMethod | RequestMethod;

    request: ServerRequest;
    response?: Response;

    #websocket?: WebSocket & Identifier;
    #wsevent?: WebSocketEvent;
    #broadcast?: WebSocketPool;

    params : Record<string, string>;
    processedUrl: string;
    data?: T;

    constructor(mouss: Mouss, req: ServerRequest) {
        this.mouss = mouss;
        this.request = req;
        this.method = <RequestMethod> req.method;
        this.params = {};
        this.processedUrl = "";
    }

    get websocket(): (WebSocket & Identifier) | undefined{
        if (this.isWSAccepted) {
            return this.#websocket;
        }
        else {
            return undefined;
        }
    }

    get wsevent(): WebSocketEvent | undefined{
        if (this.isWSAccepted) {
            return this.#wsevent;
        }
        else {
            return undefined;
        }
    }

    get broadcast(): WebSocketPool | undefined{
        if (this.isWSAccepted) {
            return this.#broadcast;
        }
        else {
            return undefined;
        }
    }

    set broadcast(websocketpool : WebSocketPool | undefined) {
        if (this.isWSAccepted) {
            this.#broadcast = websocketpool;
        }
    }
    
    get isWSAccepted() {
        return this.websocket && this.wsevent;
        //return this.webSocketNotUndefined(this.#websocket) && this.wsEventNotUndefined(this.#wsevent);
    }

    isWSAcceptable() : boolean {
        return !this.isWSAccepted && this.request.method == "GET" && acceptable(this.request);
    }

    async wsAccept() : Promise<void> {
        const { conn, r: bufReader, w: bufWriter, headers } = this.request;
        await acceptWebSocket({ conn, bufReader, bufWriter, headers }).then(
            websocket => {
                this.#websocket = {
                    ...websocket,
                    ...{ id: v4.generate() }
                }
            }
        );
    }

    setEvent(event: WebSocketEvent) {
        this.#wsevent = event;
        if (typeof event === "string") {
            this.method = "TEXT"
        } else if (event instanceof Uint8Array) {
            this.method = "BINARY";
        } else if (isWebSocketPingEvent(event)) {
            this.method = "PING";
        } else if (isWebSocketCloseEvent(event)) {
            this.method = "CLOSE";
        }
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
    //TODO : add helpers for response : cookies, contenttype, renderer ?
}