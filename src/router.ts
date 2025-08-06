import { ActiveContextHandler, ContextTypes, PassiveContextHandler } from './context';
import { joinUri } from './utils';

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export type RouteMethod =  HTTPRouteMethod | 'ws';

export interface HTTPRoute<CT extends ContextTypes> {
	method : HTTPRouteMethod;
	pattern: string;
	handler: ActiveContextHandler<CT>;
};

export interface Middleware<CT extends ContextTypes>{
	pattern : string;
	handler: PassiveContextHandler<CT>;
}

export type WSRouteOptions = {
	maxBackPressure? : number;
}

export interface WSRoute<CT extends ContextTypes>{
	pattern : string;
	options? : WSRouteOptions;
	handler: PassiveContextHandler<CT>;
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
	 * Register new route
	 * If middlewares are provided, record them using 'use' method
	 * @param method 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	add<CT extends DefaultContextTypes = DefaultContextTypes>(method : HTTPRouteMethod, pattern : string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]){
		// ? NOTE WHAT ABOUT MULTIPLE HANDLERS ?
		// ? HOW TO HANDLE RETURNED DATA => IF handler has a return statement
		
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this._routes.push({method, pattern, handler : handlers[0]});
		else{
			// Last one is always an ActiveContextHandler
			const handler : ActiveContextHandler<CT> = handlers.pop() as ActiveContextHandler<CT>;
			this.use(pattern, ...(handlers as PassiveContextHandler<CT>[]));
			this._routes[method].push({pattern, handler});
		}

		return this;
	}

	/**
	 * Register middleware or router
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	use<CT extends DefaultContextTypes>(pattern : string, ...handlers : Array<PassiveContextHandler<CT> | Router<CT>>){
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
				this._middlewares.push({pattern, handler : handlers[i] as PassiveContextHandler<CT>});
			}
		}

		return this;
	}
	
	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	any<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('any', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	del<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('del', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	get<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('get', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	sse<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.get<CT>(pattern, (c) => c.sustain(), ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	head<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('head', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	options<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('options', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	post<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('post', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	patch<CT extends DefaultContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('patch', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param args 
	 * @returns 
	 */
	ws<CT extends DefaultContextTypes>(pattern: string, ...args : [WSRouteOptions | PassiveContextHandler<CT>, ...PassiveContextHandler<CT>[]]){
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
			const handler = args.pop() as PassiveContextHandler<CT>;
			const options = typeof args[0] === "function" ? undefined : args.shift() as WSRouteOptions;
			this.use(pattern, ...(args as PassiveContextHandler<CT>[]));
			this._wsroutes.push({pattern, options, handler});
		}

		return this;
	}
}