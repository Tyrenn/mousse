//@ts-ignore
import { Handler, HandlerFunction, Handlers, isHandler, Method, isWebSocketConnectEvent, WSHandlers, HTTPHandlers } from "./types.ts";
//@ts-ignore
import { Context } from "./context.ts";
//@ts-ignore
import { Route } from "./route.ts"

export class Router implements Handler{
	#routes : Record<Method, Array<Route>> = {
		DELETE :    new Array<Route>(),
		GET :       new Array<Route>(),
		HEAD :      new Array<Route>(),
		OPTIONS :   new Array<Route>(),
		PATCH :     new Array<Route>(),
		POST :      new Array<Route>(),
		PUT :       new Array<Route>(),
		TRACE:      new Array<Route>(),
		WS:	new Array<Route>()	
	}

  #routers: Array<Route> = new Array<Route>();

	#preroute: Route = new Route("/");

	#lastroute: Route = new Route("/");

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

	use(path?: string, ...handlers: HTTPHandlers): this{
    if (!path)
      path = "";
    for (let handler of handlers) {
      if (handler instanceof Router) {
        this.#routers.push(new Route(path, handler));
      }
      else {
        this.any(path, handler);
      }
    }
    
    return this;
	}

//For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
	add(method : Method | Array<Method>, path? : string, ...handlers : Handlers) : this {
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
	
	any(path?: string, ...handlers: HTTPHandlers): this {
		return this.add(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"], path, ...handlers);
	}
	delete(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("DELETE", path, ...handlers);
	}
	get(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("GET", path, ...handlers);
	}
	head(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("HEAD", path, ...handlers);
	}
	options(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("OPTIONS", path, ...handlers);
	}
	patch(path?: string, ...handlers: HTTPHandlers) : this {
		return this.add("PATCH", path, ...handlers);
	}
	post(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("POST", path, ...handlers);
	}
	put(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("PUT", path, ...handlers);
	}
	trace(path?: string, ...handlers: HTTPHandlers): this {
		return this.add("TRACE", path, ...handlers);
	}

	ws(path?: string, ...handlers: WSHandlers): Router{
		if (!this.#wsupgraded)
			this.wsupgrade();
		if (!path)
			path = "";
		return this.add("WS", path, ...handlers);
	}

	pre(...handlers: HTTPHandlers): this{
		for(var handler of handlers){
			//Check if Handler or HandlerFunction
			if(isHandler(handler)){
				this.#preroute.addHandler(handler);
			}
			else {
				//If HandlerFunction need to transform it as handler
				this.#preroute.addHandler(this.makeHandler(handler));
			}
		}
		return this;
	}

	last(...handlers: HTTPHandlers): this{
		for(var handler of handlers){
			//Check if Handler or HandlerFunction
			if(isHandler(handler)){
				this.#lastroute.addHandler(handler);
			}
			else {
				//If HandlerFunction need to transform it as handler
				this.#lastroute.addHandler(this.makeHandler(handler));
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
		/* Execute Pre Handlers */
		this.#preroute.handle(context);

		/* WS handle */
		let matched: boolean = false;

		/* Classic Handling */
		//Finding a route that matches the request url
		console.log("  ---- \n");
		console.log("Req url : ", context.url);
		console.log("Context ProcessedUrl :", context.urlpcd);

		let remainingUrl : string = context.url.replace(context.urlpcd, "");
		console.log("Remaining : ", remainingUrl);

		for (let route of this.#routes[context.method]) {
			if (route.match(remainingUrl)) {
				matched = true;
				route.handle(context);
			}
    }
    
    for (let route of this.#routers) {
      if (route.match(remainingUrl)) {
        matched = true;
        route.handle(context);
      }
    }
		console.log(context.method, context.urlpcd, context.url);
		console.log("matched :",  matched);

		if(context.event && isWebSocketConnectEvent(context.event) && !matched) {
			context.close();
		}

		/* Execute Last Handlers */
		this.#lastroute.handle(context);

		if(next)
			next();
	}

	//handle dispatches context to corresponding route
	private async handleNoWS(context: Context, next?: () => void) {
		/* Execute Pre Handlers */
		this.#preroute.handle(context);

		/* Classic Handling */
		//Finding a route that matches the request url
		let remainingUrl : string = context.url.replace(/\/$/, '').replace(context.urlpcd, "");

		for (var route of this.#routes[context.method]) {
			if (route.match(remainingUrl)) {
				route.handle(context);
			}
		}

		/* Execute Last Handlers */
		this.#lastroute.handle(context);

		if(next)
			next();
	}
}