import { Handler, ContextTypes, MiddlewareHandler, PATCHHandlers, POSTHandlers, GETHandlers, DELHandlers, Handlers, HEADHandlers, OPTIONSHandlers, PUTHandlers, WSHandler } from './context.js';
import { joinUri } from './utils.js';

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export type RouteMethod =  HTTPRouteMethod | 'ws';

export interface HTTPRoute<CT extends ContextTypes> {
	method : HTTPRouteMethod;
	pattern: string;
	handler: Handler<CT>;
};

export interface Middleware<CT extends ContextTypes>{
	pattern : string;
	handler: MiddlewareHandler<CT>;
}

export type WSRouteOptions = {
	maxBackPressure? : number;
}

export interface WSRoute<CT extends ContextTypes>{
	pattern : string;
	options? : WSRouteOptions;
	handler: MiddlewareHandler<CT>;
}

/**
 * Router are simply collection of routes and middlewares
 * They can be used as middleware in the Mousse or other Router 'use' method
 */
export class Router<DefaultContextTypes extends ContextTypes = any>{
	private _routes : HTTPRoute<any>[] = new Array();

	private _middlewares : Middleware<any>[] = new Array();

	private _wsroutes : WSRoute<any>[] = new Array();

	constructor(){
	
	}

	get routes(){
		return this._routes;
	}

	get middlewares(){
		return this._middlewares;
	}

	get wsroutes(){
		return this._wsroutes;	
	}

	/**
	 * Register middleware or router
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	use<CT extends DefaultContextTypes>(pattern : string, ...handlers : Array<MiddlewareHandler<CT> | Router<CT>>){
		if(handlers.length < 1)
			throw new Error(`At least one handler is required in 'use' for pattern ${pattern}`);
		
		for(let i = 0; i < handlers.length; i++){
			if(handlers[i] instanceof Router){
				const router = handlers[i] as Router;

				for(let j = 0; j < router.middlewares.length; j++){
					const middleware = router.middlewares[j];
					this._middlewares.push({pattern : joinUri(pattern, middleware.pattern), handler : middleware.handler});
				}
				
				for(let j = 0; j < router.routes.length; j++){
					const route = router.routes[j];
					this._routes.push({method : route.method, pattern : joinUri(pattern, route.pattern), handler : route.handler});
				}

				for(let j = 0; j < router.wsroutes.length; j++){
					const wsroute = router.wsroutes[j];
					this._wsroutes.push({pattern : joinUri(pattern, wsroute.pattern), handler : wsroute.handler, options : wsroute.options});
				}
			}
			else{
				this._middlewares.push({pattern, handler : handlers[i] as MiddlewareHandler<CT>});
			}
		}

		return this;
	}

	/**
	 * 
	 * @param pattern 
	 * @param args 
	 * @returns 
	 */
	ws<CT extends DefaultContextTypes>(pattern: string, ...args : [WSRouteOptions | WSHandler<CT>, ...WSHandler<CT>[]]){
		if(args.length < 1){
			this._wsroutes.push({pattern, handler : () => {}});
		}
		else if(args.length == 1 && typeof args[0] === "function"){
			this._wsroutes.push({pattern, handler : args[0]});
		}
		else if(args.length == 1 && typeof args[0] !== "function"){
			this._wsroutes.push({pattern, options : args[0], handler : () => {}});
		}
		else{
			const handler = args.pop() as MiddlewareHandler<CT>;
			const options = typeof args[0] === "function" ? undefined : args.shift() as WSRouteOptions;
			this.use(pattern, ...(args as MiddlewareHandler<CT>[]));
			this._wsroutes.push({pattern, options, handler});
		}

		return this;
	}

	/**
	 * Register new route
	 * If middlewares are provided, record them using 'use' method
	 * @param method 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "patch", pattern : string, ...handlers : PATCHHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "post", pattern : string, ...handlers : POSTHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "put", pattern : string, ...handlers : PUTHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "get", pattern : string, ...handlers : GETHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "head", pattern : string, ...handlers : HEADHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "options", pattern : string, ...handlers : OPTIONSHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "del", pattern : string, ...handlers : DELHandlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : "any", pattern : string, ...handlers : Handlers<CT>) : Router<DefaultContextTypes>;
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : HTTPRouteMethod, pattern : string, ...handlers : Handlers<CT>){
		// ? NOTE WHAT ABOUT MULTIPLE HANDLERS ?
		// ? HOW TO HANDLE RETURNED DATA => IF handler has a return statement
		
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this._routes.push({method, pattern, handler : handlers[0]});
		else{
			// Last one is always an ActiveContextHandler
			const handler : Handler<CT> = handlers.pop() as Handler<CT>;
			this.use(pattern, ...(handlers as MiddlewareHandler<CT>[]));
			this._routes.push({method, pattern, handler});
		}

		return this;
	}
	
	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	any<CT extends DefaultContextTypes>(pattern: string, ...handlers : Handlers<CT>) { 
		return this.add<CT>('any', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	del<CT extends DefaultContextTypes>(pattern: string, ...handlers : DELHandlers<CT>) { 
		return this.add<CT>('del', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	get<CT extends DefaultContextTypes>(pattern: string, ...handlers : GETHandlers<CT>) {
		return this.add<CT>('get', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	sse<CT extends DefaultContextTypes>(pattern: string, ...handlers : GETHandlers<CT>) {
		return this.get<CT>(pattern, (c : any) => c.sustain(), ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	head<CT extends DefaultContextTypes>(pattern: string, ...handlers : HEADHandlers<CT>) {
		return this.add<CT>('head', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	options<CT extends DefaultContextTypes>(pattern: string, ...handlers : OPTIONSHandlers<CT>) {
		return this.add<CT>('options', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	post<CT extends DefaultContextTypes>(pattern: string, ...handlers : POSTHandlers<CT>) { 
		return this.add<CT>('post', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	patch<CT extends DefaultContextTypes>(pattern: string, ...handlers : PATCHHandlers<CT>) { 
		return this.add<CT>('patch', pattern, ...handlers);
	}
}