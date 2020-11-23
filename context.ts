//@ts-ignore
import type { Response, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"
//@ts-ignore
import { acceptable, acceptWebSocket, WebSocket } from "https://deno.land/std@0.78.0/ws/mod.ts";
//@ts-ignore
import { BufReader, BufWriter } from "https://deno.land/std@0.78.0/io/bufio.ts";

export class Context<T = any>{

    req: ServerRequest;
    
    #res?: Response;
    #websocket?: WebSocket;
    isWSUpgraded: Boolean = false;

    params : Record<string, string>;
    processedUrl: string;
    data: T | undefined;

    constructor(req : ServerRequest){
        this.req = req;
        this.params = {};
        this.processedUrl = "";
    }

    get websocket(): WebSocket | undefined{
        return this.#websocket;
    }

    isAcceptable() : boolean {
        return !this.isWSUpgraded && this.req.method == "GET" && acceptable(this.req);
    }

    async wsUpgrade() : Promise<void> {
        if (acceptable(this.req) && !this.isWSUpgraded) {
            this.isWSUpgraded = true;
            this.req.method = "WS";
            const { conn, r: bufReader, w: bufWriter, headers } = this.req;
            await acceptWebSocket({ conn, bufReader, bufWriter, headers })
                .then((websocket: WebSocket) => this.#websocket = websocket);
        }
        else {
            throw ("Request is not acceptable");
        }
    }

    respond(res?: Response) {
        if (this.isWSUpgraded) {
            throw ("Request is a websocket and can't be answered");
        }
        if (res) {
            this.req.respond(res);
        }
        else if(this.#res) {
            this.req.respond(this.#res);
        }
        else {
            this.req.respond({});
        }
    }

    //TODO : add helpers for response : cookies, contenttype, renderer ?
}