import { isHTTPContextMethod, Context, SSEContext, WSContext, CommonContext, HTTPContext, ContextHandler, ContextHandlerFunction, ContextHandlers, ContextMethod, HTTPContextMethod, isHandler, isHandlerFunctionNoNext } from "./context.ts";
import { Route } from "./route.ts"
//@ts-ignore
import { extname, mime, MimeExtensions } from "./ext.ts";

const SSEFirstHandler = {
  handle: async (c: CommonContext, next?: (() => void | Promise<void>)) => {
    if (c.sustainable) {
      await c.sustain();
      c.method = "SSE";
    }
    else{
      if(next) next();
    } 
  }
};

const WSFirstHandler =  {
  handle: async (c: CommonContext, next?: (() => void | Promise<void>)) => {
    if (c.upgradable) {
      await c.upgrade();
      c.method = "WS";
    }
    else {
      if (next) next();
    }
  }
};

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
    SSE:        new Array<Route>(),
	}

  #middlewares: Array<Route> = new Array<Route>();

	private makeHandler(fn: ContextHandlerFunction<CommonContext>): ContextHandler<CommonContext>{
		//Has no next parameter
    if (isHandlerFunctionNoNext(fn)) {
			return {handle : async (context : CommonContext, next : () => void | Promise<void>) => {
				await fn.apply(this, [context])
				if (next)
					await next();
			}}
    }
    //Has a next parameter
		else {
			return {handle : async (context:  CommonContext, next : () => void | Promise<void>) => {
				await fn.apply(this, [context, next]);
			}}  
		}
  };
  
  /**
   * Register a particular handler that will serve any extensions type file at path if requested
   * @param path 
   * @param extensions 
   */
  static(path?: string, extensions?: string | Array<string>): this{    
    let handler: ContextHandler<HTTPContext>;
    if (extensions) {
      handler = {
        async handle(context: HTTPContext, next: () => void | Promise<void>) {
          if (extensions === extname(context.request.url) || extensions.includes(extname(context.request.url))) {
            //console.log(context.request.url);
            await context.file(context.request.url);
          }
          else {
            await next();
          }
        }
      }
    }
    else {
      handler = {
        async handle(context: HTTPContext, next: () => void | Promise<void>) {
          await context.file(context.request.url);
          await next();
        }
      }
    }

    this.insert<HTTPContext>("GET", 0, path, handler);

    return this;
  }

  /**
   * Register handlers functions or objects in middlewares stack to send Context to.
   * If a handler is a router, a first specific handler is register in GET route in top of the handler stack.
   * @param path The path you want the handler to match, default is empty string so every Context will go through the handlers
   * @param handlers As many handler function or handler object you want
   */
	use<T extends CommonContext = Context>(path?: string, ...handlers: ContextHandlers<T>): this{
    if (!path)
      path = "";
    
    if (path.length > 1) {
			path = path.replace(/\/$/, '');
		}
    
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
  
  /**
   * insert handlers to the route stack at index, matching the specified path and request method
   * @param method Type of request method the route is supposed to handle
   * @param path Request path the route is supposed to match
   * @param index Index in stack at which handlers will be inserted
   * @param handlers Context handlers
   */
  insert<T extends CommonContext = Context>(method: ContextMethod | Array<ContextMethod>, index: number, path?: string, ...handlers: ContextHandlers<T>): this{
    if (!path)
        path = "";

    if (Array.isArray(method)) {
      for (let m of method) {
        this.insert<T>(m, index, path, ...handlers);
      }
      return this;
    }
  
    let routeIndex : number = this.#routes[method].findIndex(route => route.path === path);
    if (routeIndex < 0) {
      if (method === "SSE") {
        this.insert<T>("GET", 0, path, SSEFirstHandler);
      }
      if (method === "WS") {
        this.insert<T>("GET", 0, path, WSFirstHandler);
      } 
      (this.#routes[method]).push(new Route(path));
      routeIndex = (this.#routes[method]).length - 1;
    }

    for (var handler of handlers) {
      if (isHandler<T>(handler)) {
        (this.#routes[method])[routeIndex].addHandler(handler as ContextHandler<CommonContext>, index);
      }
      else {
        (this.#routes[method])[routeIndex].addHandler(this.makeHandler(handler as ContextHandlerFunction<CommonContext>), index);
      }
    }

    return this;
  }

  /**
   * Add handlers to the route stack, matching the specified path and request method
   * @param method Type of request method the route is supposed to handle
   * @param path Request path the route is supposed to match
   * @param handlers Context handlers
   */
  add<T extends CommonContext = Context>(method : ContextMethod | Array<ContextMethod>, path? : string, ...handlers : ContextHandlers<T>) : this {
    if (!path)
      path = "";

    if (Array.isArray(method)) {
      for (let m of method) {
        this.add<T>(m, path, ...handlers);
      }
      return this;
    }

    let index : number = this.#routes[method].findIndex(route => route.path === path);
    if (index < 0) { // Route doesn't exists, push a new one
      //If method is SSE or WS, adding a converter handler on the GET route as first handler
      if (method === "SSE") {
        this.insert<T>("GET", 0, path, SSEFirstHandler);
      }
      if (method === "WS") {
        this.insert<T>("GET", 0, path, WSFirstHandler);
      } 
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
	ws<T extends WSContext = WSContext>(path?: string, ...handlers: ContextHandlers<T>): this{
		return this.add<T>("WS", path, ...handlers);
  }
  sse<T extends SSEContext = SSEContext>(path?: string, ...handlers: ContextHandlers<T>): this{
    return this.add<T>("SSE", path, ...handlers);
  }

  /**
   * Function called to handle a context. Each router is in itself an handler object.
   * First pocess middlewares
   * Then process context if method is GET in order to raise context to WS or SSE if possible 
   * Then process all other method context 
   * @param context Context object wrapping request, response and multiple utility functions
   * @param next Handler Control Flow Function which is called if available to pass the Context through
   */
	async handle(context: Context, next: () => Promise<void> | void) : Promise<void> {

    let remainingUrl: string = context.url.replace(context.urlpcd, "");

    for (let route of this.#middlewares) {
      if (route.match(remainingUrl)) {
        await route.handle(context);
      }
    }

    if (context.method === "GET") {
      for (var route of this.#routes[context.method]) {
        if (route.match(remainingUrl)) {
          await route.handle(context);
          break;
        }
      }
    }

    if (context.method != "GET") {
      for (var route of this.#routes[context.method]) {
        if (route.match(remainingUrl)) {
          await route.handle(context);
        }
      }
    }
		
    await next();
	}
}