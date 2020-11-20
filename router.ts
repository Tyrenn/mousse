//@ts-ignore
import { Handler, HandlerFunction, Handlers, isHandler, RequestMethod } from "./types.ts";
//@ts-ignore
import { Context } from "./context.ts";
//@ts-ignore
import { Route } from "./route.ts"

export class Router implements Handler{
    routes : Record<"CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE", Array<Route>> = {
        CONNECT :   new Array<Route>(),
        DELETE :    new Array<Route>(),
        GET :       new Array<Route>(),
        HEAD :      new Array<Route>(),
        OPTIONS :   new Array<Route>(),
        PATCH :     new Array<Route>(),
        POST :      new Array<Route>(),
        PUT :       new Array<Route>(),
        TRACE :     new Array<Route>()
    }

    preHandlers: Array<Handler> = new Array<Handler>();

    lastHandlers: Array<Handler> = new Array<Handler>();

    constructor(){

    }

    private makeHandler(fn: HandlerFunction): Handler{
        if (fn.length < 2) {
            return {handle(context : Context, next : () => void){
                fn.apply(this, [context])
                next();
            }}
        }
        else {
            return {handle(context: Context, next : () => void){
                fn.apply(this, [context, next]);
            }}  
        }
    }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
    add(path : string, method : RequestMethod, ...handlers : Handlers) : Router {
        
        let index : number = this.routes[method].findIndex(route => route.path === path);
        if (index < 0) {
            (this.routes[method]).push(new Route(path, method));
            index = (this.routes[method]).length - 1;
        }

        for (var handler of handlers) {
            //Check if Handler or HandlerFunction
            if(isHandler(handler)){
                (this.routes[method])[index].addHandler(handler);
            }
            else {
                //Need to transform it as handler
                (this.routes[method])[index].addHandler(this.makeHandler(handler));
            }
        }

        return this;
    }

    pre(...handlers: Handlers): Router{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isHandler(handler)){
                this.preHandlers.push(handler);
            }
            else {
                //Need to transform it as handler
                this.preHandlers.push(this.makeHandler(handler));
            }
        }

        return this;
    }

    last(...handlers: Handlers): Router{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isHandler(handler)){
                this.lastHandlers.push(handler);
            }
            else {
                //Need to transform it as handler
                this.lastHandlers.push(this.makeHandler(handler));
            }
        }

        return this;
    }


    //handle dispatches context to corresponding route
    handle(context: Context, next: () => void) {
        
        /* Execute Pre Handlers */
        let index : number = 0;
        let preHandlerStack: Array<Handler> = this.preHandlers;
        
        let nextPreHandler = function (){
            if(index < preHandlerStack.length)
                preHandlerStack[index++].handle(context, nextPreHandler);
        };



        /* Classic Handling */
        //Finding a route that matches the request url
        let match: Boolean;
        index = 0;
        
        console.log("In Router : ", " context req : ", context.req.method, " ", context.req.url);

        let currentUrl: string = context.req.url.replace(/\/$/, '');
        console.log(currentUrl);
        let remainingUrl : string = currentUrl.replace(context.processedUrl, "");
        console.log(remainingUrl);

        for (var route of this.routes[<RequestMethod>context.req.method]) {
            console.log(route);
            console.log(route.match(remainingUrl));
            if (route.match(remainingUrl)) {
                route.handle(context);
            }
        }

        //? Why ?
        //context.processedUrl = context.req.url;

        

        /* Execute Last Handlers */
        index = 0;
        let lastHandlersStack: Array<Handler> = this.lastHandlers;
        
        let nextPostHandler = function (){
            if(index < lastHandlersStack.length){
                lastHandlersStack[index++].handle(context, nextPostHandler);
            }
        };

        next();
    }
}