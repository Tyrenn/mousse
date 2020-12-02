//@ts-ignore
import { Context, ContextHandler, ContextHandlerFunction, ContextHandlers, ContextMethod, isHandler } from "./context.ts";
//@ts-ignore
import { Route } from "./route.ts"
//@ts-ignore
import { isWebSocketConnectEvent } from "./websocket.ts";

export class Router implements ContextHandler{
	#routes : Record<ContextMethod, Array<Route>> = {
		DELETE :    new Array<Route>(),
		GET :       new Array<Route>(),
		HEAD :      new Array<Route>(),
		OPTIONS :   new Array<Route>(),
		PATCH :     new Array<Route>(),
		POST :      new Array<Route>(),
		PUT :       new Array<Route>(),
		TRACE:      new Array<Route>(),
    WS:         new Array<Route>(),
    SSE:        new Array<Route>()
	}

  #middlewares: Array<Route> = new Array<Route>();

	#wsupgraded: boolean = false;

	handle: ContextHandlerFunction;
	
	constructor(){
		this.handle = this.handleNoWS;
	}

	private makeHandler(fn: ContextHandlerFunction): ContextHandler{
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

	use(path?: string, ...handlers: ContextHandlers): this{
    if (!path)
      path = "";
    
    for (var handler of handlers) {
			//Check if Handler or HandlerFunction
			if(isHandler(handler)){
				this.#middlewares.push(new Route(path, handler));
			}
			else {
				//Need to transform it as handler
					this.#middlewares.push(new Route(path, this.makeHandler(handler)));
			}
		}
    
    return this;
	}

//For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
	add(method : ContextMethod | Array<ContextMethod>, path? : string, ...handlers : ContextHandlers) : this {
		if (!path)
			path = "";

		if (Array.isArray(method)) {
			for (let m of method) {
				this.add(m, path, ...handlers);
			}
			return this;
		}

		//?Find the corresponding route
		let index : number = this.#routes[method].findIndex(route => route.path === path);
		if (index < 0) {
			(this.#routes[method]).push(new Route(path));
			index = (this.#routes[method]).length - 1;
		}

		for (var handler of handlers) {
			//Check if Handler or HandlerFunction
			if(isHandler(handler)){
				(this.#routes[method])[index].addHandler(handler);
			}
			else {
				//Need to transform it as handler
				(this.#routes[method])[index].addHandler(this.makeHandler(handler));
			}
		}

		return this;
	}
	
	any(path?: string, ...handlers: ContextHandlers): this {
		return this.add(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"], path, ...handlers);
	}
	delete(path?: string, ...handlers: ContextHandlers): this {
		return this.add("DELETE", path, ...handlers);
	}
	get(path?: string, ...handlers: ContextHandlers): this {
		return this.add("GET", path, ...handlers);
	}
	head(path?: string, ...handlers: ContextHandlers): this {
		return this.add("HEAD", path, ...handlers);
	}
	options(path?: string, ...handlers: ContextHandlers): this {
		return this.add("OPTIONS", path, ...handlers);
	}
	patch(path?: string, ...handlers: ContextHandlers) : this {
		return this.add("PATCH", path, ...handlers);
	}
	post(path?: string, ...handlers: ContextHandlers): this {
		return this.add("POST", path, ...handlers);
	}
	put(path?: string, ...handlers: ContextHandlers): this {
		return this.add("PUT", path, ...handlers);
	}
	trace(path?: string, ...handlers: ContextHandlers): this {
		return this.add("TRACE", path, ...handlers);
	}

	ws(path?: string, ...handlers: ContextHandlers): Router{
		if (!this.#wsupgraded)
			this.wsupgrade();
		if (!path)
			path = "";
		return this.add("WS", path, ...handlers);
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

	private handleWS = async (context: Context, next?: () => void) => {
    
    //Upgrade context if possible then handled as a "WS" typed context
    if (context.upgradable) {
      context.upgrade(this.handleWS);
      return;
    }

    console.log("URLPCD : ", context.urlpcd);

		let matched: boolean = false;
		//Finding a route that matches the request url
		let remainingUrl : string = context.url.replace(context.urlpcd, "");

		for (let route of this.#routes[context.method]) {
			if (route.match(remainingUrl)) {
				matched = true;
				route.handle(context);
			}
    }
    
    for (let route of this.#middlewares) {
      if (route.match(remainingUrl)) {
        matched = true;
        route.handle(context);
      }
    }
		//console.log("matched :",  matched);

		if(context.event && isWebSocketConnectEvent(context.event) && !matched) {
			context.close();
    }

		if(next)
			next();
	}

	//handle dispatches context to corresponding route
	private handleNoWS = async (context: Context, next?: () => void) => {
    console.log("URLPCD : ", context.urlpcd);
  
    /* Classic Handling */
		//Finding a route that matches the request url
		let remainingUrl : string = context.url.replace(context.urlpcd, "");

		for (var route of this.#routes[context.method]) {
			if (route.match(remainingUrl)) {
				route.handle(context);
			}
    }
    for (let route of this.#middlewares) {
      if (route.match(remainingUrl)) {
        route.handle(context);
      }
    }

		if(next)
			next();
	}
}