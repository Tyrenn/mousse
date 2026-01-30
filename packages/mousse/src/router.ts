import { Logger } from 'route/logger.js';
import { Handler, ContextTypes, MiddlewareHandler, PATCHHandlers, POSTHandlers, GETHandlers, DELHandlers, Handlers, HEADHandlers, OPTIONSHandlers, PUTHandlers, WSHandler, BodyParser, ResponseSerializer } from './context/index.js';
import { joinUri } from './utils.js';
import { HTTPRoute, HTTPRouteOptions } from 'route/http.js';
import { WSRoute, WSRouteOptions } from 'route/ws.js';
import { HTTPErrorHandler } from 'route/errorhandler.js';

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export type RouteMethod =  HTTPRouteMethod | 'ws';

export interface Middleware<CT extends ContextTypes, EC extends any = {}>{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
}


// TODO Add the possibility to give default bodyparser/responseserializer to route

/**
 * Router are simply collection of routes and middlewares
 * They can be used as middleware in the Mousse or other Router 'use' method
 */
export class Router<DefaultContextTypes extends ContextTypes = any, DefaultExtendContext extends any = {}>{
	protected _middlewares : Middleware<any, any>[] = new Array();

	protected _httproutes : HTTPRoute<any, any>[] = new Array();
	protected _wsroutes : WSRoute<any, any>[] = new Array();

	protected _defaultRouteOptions? : HTTPRouteOptions & WSRouteOptions;


	constructor(options? : HTTPRouteOptions & WSRouteOptions){
		this._defaultRouteOptions = options;
	}

	/**
	 * Register middleware or router
		In case of a router, middlewares and routes are copied and reset to Registered : false.
		This way a router definition can be reused multiple times.
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>) : Router<DefaultContextTypes, EC>;
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern : '', ...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>) : Router<DefaultContextTypes, EC>;
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern : string, ...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>) : Router<DefaultContextTypes, DefaultExtendContext>;
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(...args : [string, ...Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>] | Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>){
		if(args.length < 1)
			throw new Error(`At least one handler is required in 'use'`);
		
		if(typeof args[0] === "string" && args.length < 2)
			throw new Error(`At least one handler is required in 'use' for pattern ${args[0]}`);
		
		const pattern : string = typeof args[0] === "string" ? args.shift() as string : '';
		const handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>> = args as Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>;

		for(let i = 0; i < handlers.length; i++){
			if(handlers[i] instanceof Router){
				const router = handlers[i] as Router;

				for(let j = 0; j < router._middlewares.length; j++){
					const middleware = router._middlewares[j];
					this._middlewares.push({...middleware, pattern : joinUri(pattern, middleware.pattern)});
				}
				
				// Copying route replacing none defined options by defined one
				for(let j = 0; j < router._httproutes.length; j++){
					const route = router._httproutes[j];
					this._httproutes.push({...this._defaultRouteOptions, ...route, pattern : joinUri(pattern, route.pattern), registered : false});
				}

				for(let j = 0; j < router._wsroutes.length; j++){
					const wsroute = router._wsroutes[j];
					this._wsroutes.push({...wsroute, pattern : joinUri(pattern, wsroute.pattern), registered : false});
				}
			}
			else{
				this._middlewares.push({pattern, handler : handlers[i] as MiddlewareHandler<CT, EC>});
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
	ws<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [WSRouteOptions | WSHandler<CT, EC>, ...WSHandler<CT, EC>[]]){
		if(args.length < 1){
			this._wsroutes.push({...this._defaultRouteOptions, pattern, handler : () => {}, registered : false});
		}
		else if(args.length == 1 && typeof args[0] === "function"){
			this._wsroutes.push({...this._defaultRouteOptions, pattern, handler : args[0], registered : false});
		}
		else if(args.length == 1 && typeof args[0] !== "function"){
			this._wsroutes.push({...this._defaultRouteOptions, pattern, handler : () => {}, registered : false, ...args[0]});
		}
		else{
			const handler = args.pop() as MiddlewareHandler<CT, EC>;
			const options = typeof args[0] === "function" ? undefined : args.shift() as WSRouteOptions;
			this.use(pattern, ...(args as MiddlewareHandler<CT, EC>[]));
			this._wsroutes.push({...this._defaultRouteOptions, pattern, handler, registered : false, ...options});
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
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "patch", pattern : string, ...handlers : PATCHHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "patch", pattern : string, options : HTTPRouteOptions, ...handlers : PATCHHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "post", pattern : string, ...handlers : POSTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "post", pattern : string,  options : HTTPRouteOptions, ...handlers : POSTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "put", pattern : string, ...handlers : PUTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "put", pattern : string,  options : HTTPRouteOptions, ...handlers : PUTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "get", pattern : string, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "get", pattern : string,  options : HTTPRouteOptions, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "head", pattern : string, ...handlers : HEADHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "head", pattern : string,  options : HTTPRouteOptions, ...handlers : HEADHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "options", pattern : string, ...handlers : OPTIONSHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "options", pattern : string,  options : HTTPRouteOptions, ...handlers : OPTIONSHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "del", pattern : string, ...handlers : DELHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "del", pattern : string,  options : HTTPRouteOptions, ...handlers : DELHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "any", pattern : string, ...handlers : Handlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "any", pattern : string,  options : HTTPRouteOptions, ...handlers : Handlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : HTTPRouteMethod, pattern : string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : HTTPRouteMethod, pattern : string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>){
		if(args.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);
		
		if(typeof args[0] !== 'function' && args.length < 2)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		const options : HTTPRouteOptions | undefined = typeof args[0] !== "function" ? args.shift() as HTTPRouteOptions : undefined;
		const handlers : Handlers<CT, EC> = args as Handlers<CT, EC>;

		if(handlers.length == 1)
			this._httproutes.push({...this._defaultRouteOptions, method, pattern, handler : handlers[0], registered : false, ...options});
		else{
			// Last one is always an ActiveContextHandler
			const handler : Handler<CT> = handlers.pop() as Handler<CT>;
			this.use(pattern, ...(handlers as MiddlewareHandler<CT, EC>[]));
			this._httproutes.push({...this._defaultRouteOptions, method, pattern, handler, registered : false, ...options});
		}

		return this;
	}
	

	/**
	 * OPTIONS HELPER METHOD
	 */

	setDefaultLogger(logger : Logger){
		this._defaultRouteOptions = {...this._defaultRouteOptions, logger};
	}

	setDefaultHTTPErrorHandler(httpErrorHandler : HTTPErrorHandler){
		this._defaultRouteOptions = {...this._defaultRouteOptions, httpErrorHandler};
	}

	setDefaultBodyParser(bodyParser : BodyParser<any>){
		this._defaultRouteOptions = {...this._defaultRouteOptions, bodyParser};
	}

	setDefaultResponseSerializer(responseSerializer : ResponseSerializer<any>){
		this._defaultRouteOptions = {...this._defaultRouteOptions, responseSerializer};
	}





	/**
	 * HTTP HELPER METHOD
	 */


	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : Handlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : Handlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>) { 
		return this.add<CT, EC>('any', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : DELHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : DELHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...DELHandlers<CT, EC>] | DELHandlers<CT, EC>) { 
		return this.add<CT, EC>('del', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...GETHandlers<CT, EC>] | GETHandlers<CT, EC>) {
		return this.add<CT, EC>('get', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : GETHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...GETHandlers<CT, EC>] | GETHandlers<CT, EC>) {
		const options : HTTPRouteOptions | undefined = typeof args[0] === "function" ? undefined : args.shift() as HTTPRouteOptions;
		const handlers : GETHandlers<CT, EC> = args as GETHandlers<CT, EC>;
		
		if(options)
			return this.get<CT, EC>(pattern, options, (c : any) => c.sustain(), ...handlers);
		else
			return this.get<CT, EC>(pattern, (c : any) => c.sustain(), ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : HEADHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : HEADHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...HEADHandlers<CT, EC>] | HEADHandlers<CT, EC>) {
		return this.add<CT, EC>('head', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : OPTIONSHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : OPTIONSHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...OPTIONSHandlers<CT, EC>] | OPTIONSHandlers<CT, EC>) {
		return this.add<CT, EC>('options', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : POSTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>; 
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : POSTHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>; 
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...POSTHandlers<CT, EC>] | POSTHandlers<CT, EC>) { 
		return this.add<CT, EC>('post', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions, ...handlers : PATCHHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : PATCHHandlers<CT, EC>) : Router<DefaultContextTypes, DefaultExtendContext>;
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...PATCHHandlers<CT, EC>] | PATCHHandlers<CT, EC>) { 
		return this.add<CT, EC>('patch', pattern, ...args);
	}
}