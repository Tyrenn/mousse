//@ts-ignore
import { Handler, RouteInstances } from "./types.ts"
//@ts-ignore
import type { Context } from "./context.ts"
//@ts-ignore
import { match, Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'
//@ts-ignore
import { isWebSocketCloseEvent, WebSocket, WebSocketEvent } from 'https://deno.land/std@0.78.0/ws/mod.ts';
//@ts-ignore
import { WebSocketPool } from "./websocket.ts";

export class Route{
    path : string;
    handlersStack : Array<Handler> = new Array<Handler>();
    pathregexp : MatchFunction<Record<string,string>>;

    params: Record<string, string> = {};
    instances: RouteInstances = {};

    handle: ((c: Context) => void);

    constructor(path : string, isWSRoute : boolean = false, ...handlers : Array<Handler>){
        
        //Removing last / if present
        this.path = path;
        if (this.path.length > 1)
            this.path = this.path.replace(/\/$/, '');
        
        this.pathregexp = match<Record<string, string>>(path, { decode: decodeURIComponent });
        this.handlersStack = handlers;

        if (isWSRoute) {
            this.handle = this.handleWS;
        }
        else {
            this.handle = this.handleNoWS;
        }
        
    }

    match(path : string) : Boolean{
        if (path != null) {
            let match: Match<Record<string,string>> = this.pathregexp(path);

            if (typeof match != "boolean") {
                this.params = match.params;
                
                return true;
            }
            else {
                this.params = {};
                return false;
            }
        }
        else {
            return false;
        }
    }

    addHandler(handler: Handler) {
        this.handlersStack.push(handler);
    }

    handleWS(context: Context) {
        if (context.websocket) {
            /*
            if(this.wsRouteInstances.has(req.url)){
                wsRouteInstance = this.wsRouteInstances.get(req.url);
                wsRouteInstance.add(ws);
            }
            else{
                wsRouteInstance = new WSRouteInstance(req.url);
                wsRouteInstance.add(ws);
                this.wsRouteInstances.set(req.url, wsRouteInstance);
            }
            ws.routeInstance = wsRouteInstance;*/

            let processedUrl : string = context.processedUrl + this.path;

            
            if (this.instances[processedUrl]) {
                this.instances[processedUrl].add(context.websocket);
            }
            else {
                this.instances[processedUrl] = new WebSocketPool(context.websocket);
            }

            if (context.wsevent && isWebSocketCloseEvent(context.wsevent)) {
                this.instances[processedUrl].rm(context.websocket);
            }
            
            /**
             * Freeze context for same level handlers
             */

            let params : Record<string, string> = { ...context.params, ...this.params };
            let idx : number = 0;
            let handlersStack: Array<Handler> = this.handlersStack;
            let websocketpool: WebSocketPool = this.instances[processedUrl];

            let next = function (){
                if(idx < handlersStack.length){
                    context.processedUrl = processedUrl;
                    context.params = params;
                    context.broadcast = websocketpool;

                    handlersStack[idx++].handle(context, next);
                }
            };
            
        }
    }


    handleNoWS(context : Context){
        /**
         * Check the pre-processed Url and save it to a fixed object sent to each child routes
        */
        let processedUrl : string = context.processedUrl + this.path;
        let params : Record<string, string> = { ...context.params, ...this.params };
        let idx : number = 0;
        let stack : Array<Handler> = this.handlersStack;

        
        let next = function (){
            if(idx < stack.length){
                //Request infos are reset before every dispatching to same level middlewares
                context.processedUrl = processedUrl;
                context.params = params;

                stack[idx++].handle(context, next);
            }
        };

        /* Execute handlers in a middleware fashion way */
        next();
    }

}