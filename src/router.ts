//@ts-ignore
import { Context, WSContext, CommonContext, HTTPContext, ContextHandler, ContextHandlerFunction, ContextHandlers, ContextMethod, isHandler } from "./context.ts";
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

	private makeHandler(fn: ContextHandlerFunction<CommonContext>): ContextHandler<CommonContext>{
		if (fn.length < 2) {
			return {handle(context : CommonContext, next? : () => Promise<void> | void){
				fn.apply(this, [context])
				if (next)
					next();
			}}
		}
		else {
			return {handle(context:  CommonContext, next? : () => Promise<void> | void){
				fn.apply(this, [context, next]);
			}}  
		}
	}

	use<T extends CommonContext = Context>(path?: string, ...handlers: ContextHandlers<T>): this{
    if (!path)
      path = "";
    
    for (var handler of handlers) {
			//Check if Handler or HandlerFunction
      if (isHandler<T>(handler)) {
				this.#middlewares.push(new Route(path, handler as ContextHandler<CommonContext>));
			}
			else {
				//Need to transform it as handler
					this.#middlewares.push(new Route(path, this.makeHandler(handler as ContextHandlerFunction<CommonContext>)));
			}
		}
    
    return this;
	}

//For now does a strange job if a router with "/test/bonjour" path given and then a handler for the path "/test/bonjour/bonsoir"
	add<T extends CommonContext = Context>(method : ContextMethod | Array<ContextMethod>, path? : string, ...handlers : ContextHandlers<T>) : this {
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
      if (isHandler<T>(handler)) {
				(this.#routes[method])[index].addHandler(handler as ContextHandler<CommonContext>);
			}
      else {
				(this.#routes[method])[index].addHandler(this.makeHandler(handler as ContextHandlerFunction<CommonContext>));
			}
		}

		return this;
	}
	
	any<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"], path, ...handlers);
	}
	delete<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("DELETE", path, ...handlers);
	}
	get<T extends CommonContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("GET", path, ...handlers);
	}
	head<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("HEAD", path, ...handlers);
	}
	options<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("OPTIONS", path, ...handlers);
	}
	patch<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>) : this {
		return this.add<T>("PATCH", path, ...handlers);
	}
	post<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("POST", path, ...handlers);
	}
	put<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("PUT", path, ...handlers);
	}
	trace<T extends HTTPContext = HTTPContext>(path?: string, ...handlers: ContextHandlers<T>): this {
		return this.add<T>("TRACE", path, ...handlers);
	}

	ws<T extends WSContext = WSContext>(path?: string, ...handlers: ContextHandlers<T>): Router{
		if (!this.#wsupgraded)
			this.wsupgrade();
		if (!path)
			path = "";
		return this.add<T>("WS", path, ...handlers);
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

		if(!matched) {
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