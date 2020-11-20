//@ts-ignore
import { WSHandler, WSHandlerFunction, WSHandlers, isWSHandler } from "./types.ts";
//@ts-ignore
import { WSContext } from "./wscontext.ts";
//@ts-ignore
import { WSRoute } from "./wsroute.ts"

export class WSRouter implements WSHandler{
    routes: Array<WSRoute> = new Array<WSRoute>();

    preHandlers: Array<WSHandler> = new Array<WSHandler>();

    lastHandlers: Array<WSHandler> = new Array<WSHandler>();

    constructor(){

    }

    private makeHandler(fn: WSHandlerFunction): WSHandler{
        if (fn.length < 2) {
            return {handle(context : WSContext, next : () => void){
                fn.apply(this, [context])
                next();
            }}
        }
        else {
            return {handle(context: WSContext, next : () => void){
                fn.apply(this, [context, next]);
            }}  
        }
    }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
    add(path : string, ...handlers : WSHandlers) : WSRouter {
        
        let index : number = this.routes.findIndex(route => route.path === path);
        if (index < 0) {
            this.routes.push(new WSRoute(path));
            index = this.routes.length - 1;
        }

        for (var handler of handlers) {
            //Check if Handler or HandlerFunction
            if(isWSHandler(handler)){
                this.routes[index].addHandler(handler);
            }
            else {
                //Need to transform it as handler
                this.routes[index].addHandler(this.makeHandler(handler));
            }
        }

        return this;
    }

    pre(...handlers: WSHandlers): WSRouter{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isWSHandler(handler)){
                this.preHandlers.push(handler);
            }
            else {
                //Need to transform it as handler
                this.preHandlers.push(this.makeHandler(handler));
            }
        }

        return this;
    }

    last(...handlers: WSHandlers): WSRouter{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isWSHandler(handler)){
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
    handle(context: WSContext, next: () => void) {
        
        /* Execute Pre Handlers */
        let index : number = 0;
        let preHandlerStack: Array<WSHandler> = this.preHandlers;
        
        let nextPreHandler = function (){
            if(index < preHandlerStack.length)
                preHandlerStack[index++].handle(context, nextPreHandler);
        };

        /* Classic Handling */
        //Finding a route that matches the request url
        let match: Boolean;
        index = 0;

        let currentUrl: string = context.url.replace(/\/$/, '');
        console.log(currentUrl);
        let remainingUrl : string = currentUrl.replace(context.processedUrl, "");
        console.log(remainingUrl);

        for (var route of this.routes) {
            console.log(route);
            console.log(route.match(remainingUrl));
            if (route.match(remainingUrl)) {
                route.handle(context);
            }
        }

        /* Execute Last Handlers */
        index = 0;
        let lastHandlersStack: Array<WSHandler> = this.lastHandlers;
        
        let nextLastHandler = function (){
            if(index < lastHandlersStack.length){
                lastHandlersStack[index++].handle(context, nextLastHandler);
            }
        };

        next();
    }
}