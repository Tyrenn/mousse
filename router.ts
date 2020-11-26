//@ts-ignore
import { Handler, HandlerFunction, Handlers, isHandler, Method } from "./types.ts";
//@ts-ignore
import { Context, HTTPContext, WSContext } from "./context.ts";
//@ts-ignore
import { Route } from "./route.ts"

export class Router implements Handler{
    routes : Record<Method, Array<Route>> = {
        DELETE :    new Array<Route>(),
        GET :       new Array<Route>(),
        HEAD :      new Array<Route>(),
        OPTIONS :   new Array<Route>(),
        PATCH :     new Array<Route>(),
        POST :      new Array<Route>(),
        PUT :       new Array<Route>(),
        TRACE:      new Array<Route>(),
        WS :        new Array<Route>()
    }

    preroute: Route = new Route("/");

    lastroute: Route = new Route("/");

    #wsupgraded: boolean = false;

    //handle: (context:  HTTPContext | WSContext, next?: () => void) => Promise<void>;
	handle: HandlerFunction;
	
    constructor(){
        this.handle = this.handleNoWS;
	}

    private makeHandler(fn: HandlerFunction): Handler{
        if (fn.length < 2) {
            return {handle(context : Context, next? : () => Promise<void> | void){
				fn.apply(this, [context])
				if (next)
					next();
            }}
        }
        else {
            return {handle(context:  Context, next? : () => Promise<void> | void){
                fn.apply(this, [context, next]);
            }}  
        }
    }

    use(path: string, ...handlers: Handlers): Router{
        this.ws(path, ...handlers);
        return this.any(path, ...handlers);
    }

    //For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
    add(path : string, method : Method | Array<Method>, ...handlers : Handlers) : Router {
        
        if (Array.isArray(method)) {
            for (let m of method) {
                this.add(path, m, ...handlers);
            }
            return this;
        }

        //?Find the corresponding route
        let index : number = this.routes[method].findIndex(route => route.path === path);
        if (index < 0) {
            (this.routes[method]).push(new Route(path));
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
	
    any(path: string, ...handlers: Handlers) : Router {
        return this.add(path, ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"], ...handlers);
	}
	delete(path: string, ...handlers : Handlers) : Router {
		return this.add(path, "DELETE", ...handlers);
	}
	get(path: string, ...handlers : Handlers) : Router {
		return this.add(path, "GET", ...handlers);
	}
	head(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "HEAD", ...handlers);
	}
	options(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "OPTIONS", ...handlers);
	}
	patch(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "PATCH", ...handlers);
	}
	post(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "POST", ...handlers);
	}
	put(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "PUT", ...handlers);
	}
	trace(path: string, ...handlers: Handlers) : Router {
		return this.add(path, "TRACE", ...handlers);
	}
	ws(path: string, ...handlers: Handlers): Router{
		if (!this.wsupgraded)
			this.wsupgrade();
		return this.add(path, "WS", ...handlers);
	}

    pre(...handlers: Handlers): Router{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isHandler(handler)){
                this.preroute.addHandler(handler);
            }
            else {
                //If HandlerFunction need to transform it as handler
                this.preroute.addHandler(this.makeHandler(handler));
            }
        }
        return this;
    }

    last(...handlers: Handlers): Router{
        for(var handler of handlers){
            //Check if Handler or HandlerFunction
            if(isHandler(handler)){
                this.lastroute.addHandler(handler);
            }
            else {
                //If HandlerFunction need to transform it as handler
                this.lastroute.addHandler(this.makeHandler(handler));
            }
        }
        return this;
	}

    get wsupgraded(): boolean{
        return this.#wsupgraded;
    }

    private wsupgrade() {
        if (!this.#wsupgraded) {
            this.#wsupgraded = true;
            this.handle = this.handleWS;
        }
    }


	private async handleWS(context: Context, next?: () => void) {
		console.log("HANDLE WS", this);
        /* Execute Pre Handlers */
        this.preroute.handle(context);

        /* WS handle */
        let matched: boolean = false;

        /* Classic Handling */
        //Finding a route that matches the request url
        let remainingUrl : string = context.request.url.replace(/\/$/, '').replace(context.processedUrl, "");
        console.log(remainingUrl);

        for (var route of this.routes[context.method]) {
            if (route.match(remainingUrl)) {
                matched = true;
                route.handle(context);
            }
        }

        if (context instanceof WSContext && !matched) {
            context.close();
        }

        /* Execute Last Handlers */
        this.lastroute.handle(context);

        if(next)
            next();
    }

    //handle dispatches context to corresponding route
	private async handleNoWS(context: Context, next?: () => void) {
		console.log("HANDLE NO WS");
        /* Execute Pre Handlers */
        this.preroute.handle(context);

        /* Classic Handling */
        //Finding a route that matches the request url
        let remainingUrl : string = context.request.url.replace(/\/$/, '').replace(context.processedUrl, "");
        console.log(remainingUrl);

		for (var route of this.routes[context.method]) {
            if (route.match(remainingUrl)) {
                
                route.handle(context);
            }
        }

        /* Execute Last Handlers */
        this.lastroute.handle(context);

        if(next)
            next();
    }
}