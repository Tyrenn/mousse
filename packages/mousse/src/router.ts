import { Logger } from './module/logger.js';
import { joinUri, definedProps } from './utils.js';
import { HTTPErrorHandler } from './module/errorhandler.js';
import { HTTPRoute, WSRoute, HTTPRouteOptions, WSRouteOptions, HTTPRouteMethod } from './route.js';
import { ContextTypes } from './context.js';
import { MiddlewareHandler, WSHandler, PATCHHandlers, POSTHandlers, PUTHandlers, GETHandlers, HEADHandlers, OPTIONSHandlers, DELHandlers, Handlers, Handler } from './handler.js';
import { BodyParser } from './module/bodyparser.js';
import { ResponseSerializer } from './module/responseserializer.js';
import { DefaultHandler } from './module/defaulthandler.js';
import { Schemas, InferContextTypes } from './module/schema.js';
import { DocGen } from './module/docgen.js';
import { RouteTester } from './module/tester.js';

export interface Middleware<CT extends ContextTypes, EC extends any = {}>{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
}

export type RouterOptions = HTTPRouteOptions & WSRouteOptions & {
	defaultHandler? : DefaultHandler;
}

/**
 * Router are simply collection of routes and middlewares
 * They can be used as middleware in the Mousse or other Router 'use' method
 */
export class Router<DefaultContextTypes extends ContextTypes = any, DefaultExtendContext extends any = {}>{
	protected _middlewares : Middleware<any, any>[] = new Array();

	protected _httproutes : HTTPRoute<any, any>[] = new Array();
	protected _wsroutes : WSRoute<any, any>[] = new Array();

	protected _defaultRouteOptions? : HTTPRouteOptions & WSRouteOptions;

	protected _defaultHandler? : DefaultHandler | undefined;


	constructor(options? : RouterOptions){
		this._defaultHandler = options?.defaultHandler;
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
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>) : this;
	use<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern : string, ...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>) : this;
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

				// If no pattern, then router default handler overrides existing one.
				if(router._defaultHandler){
					const defaultHandler = router._defaultHandler;
					if(pattern && pattern != "" && pattern != "*")
						this._httproutes.push(new HTTPRoute({method: "any", pattern : joinUri(pattern, "*"), handler : (c) => defaultHandler.handle(c)}))
					else
						this._defaultHandler = defaultHandler
				}

				for(let j = 0; j < router._middlewares.length; j++){
					const middleware = router._middlewares[j];
					this._middlewares.push({...middleware, pattern : joinUri(pattern, middleware.pattern)});
				}

				// Copying route replacing none defined options by defined one
				// definedProps avoids explicit undefined route properties from shadowing this router defaults
				for(let j = 0; j < router._httproutes.length; j++){
					const route = router._httproutes[j];
					this._httproutes.push(new HTTPRoute({
						...this._defaultRouteOptions,
						...definedProps(route),
						method : route.method,
						handler : route.handler,
						pattern : joinUri(pattern, route.pattern)
					}));
				}

				for(let j = 0; j < router._wsroutes.length; j++){
					const wsroute = router._wsroutes[j];
					this._wsroutes.push(new WSRoute({
						...this._defaultRouteOptions,
						...definedProps(wsroute),
						handler : wsroute.handler,
						pattern : joinUri(pattern, wsroute.pattern)
					}));
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
	ws<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [WSRouteOptions | WSHandler<CT, EC>, ...WSHandler<CT, EC>[]]) : this {
		if(args.length < 1){
			this._wsroutes.push(new WSRoute({...this._defaultRouteOptions, pattern, handler : () => {}}));
		}
		else if(args.length == 1 && typeof args[0] === "function"){
			this._wsroutes.push(new WSRoute({...this._defaultRouteOptions, pattern, handler : args[0]}));
		}
		else if(args.length == 1 && typeof args[0] !== "function"){
			this._wsroutes.push(new WSRoute({...this._defaultRouteOptions, pattern, handler : () => {}, ...args[0]}));
		}
		else{
			const handler = args.pop() as MiddlewareHandler<CT, EC>;
			const options = typeof args[0] === "function" ? undefined : args.shift() as WSRouteOptions;
			// Remaining handlers are middlewares scoped to this route only
			this._wsroutes.push(new WSRoute({...this._defaultRouteOptions, pattern, handler, ...options, middlewares : args as MiddlewareHandler<any, any>[]}));
		}

		return this;
	}


	/**
	 * 🌐 Register new route
	 * If middlewares are provided, record them using 'use' method
	 * @param method 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "patch", pattern : string, ...handlers : PATCHHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "patch", pattern : string, options : HTTPRouteOptions, ...handlers : PATCHHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "post", pattern : string, ...handlers : POSTHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "post", pattern : string,  options : HTTPRouteOptions, ...handlers : POSTHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "put", pattern : string, ...handlers : PUTHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "put", pattern : string,  options : HTTPRouteOptions, ...handlers : PUTHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "get", pattern : string, ...handlers : GETHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "get", pattern : string,  options : HTTPRouteOptions, ...handlers : GETHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "head", pattern : string, ...handlers : HEADHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "head", pattern : string,  options : HTTPRouteOptions, ...handlers : HEADHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "options", pattern : string, ...handlers : OPTIONSHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "options", pattern : string,  options : HTTPRouteOptions, ...handlers : OPTIONSHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "del", pattern : string, ...handlers : DELHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "del", pattern : string,  options : HTTPRouteOptions, ...handlers : DELHandlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "any", pattern : string, ...handlers : Handlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : "any", pattern : string,  options : HTTPRouteOptions, ...handlers : Handlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : HTTPRouteMethod, pattern : string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>) : this;
	add<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(method : HTTPRouteMethod, pattern : string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>){
		if(args.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);
		
		if(typeof args[0] !== 'function' && args.length < 2)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		const options : HTTPRouteOptions | undefined = typeof args[0] !== "function" ? args.shift() as HTTPRouteOptions : undefined;
		const handlers : Handlers<CT, EC> = args as Handlers<CT, EC>;

		if(handlers.length == 1)
			this._httproutes.push(new HTTPRoute({...this._defaultRouteOptions, method, pattern, handler : handlers[0], ...options}));
		else{
			// Last one is always an ActiveContextHandler, previous ones are middlewares scoped to this route only
			const handler : Handler<CT> = handlers.pop() as Handler<CT>;
			this._httproutes.push(new HTTPRoute({...this._defaultRouteOptions, method, pattern, handler, ...options, middlewares : handlers as MiddlewareHandler<any, any>[]}));
		}

		return this;
	}
	

// ──────────────────────────
// │ MODULES HELPER METHODS
// ──────────────────────────

	setDefaultHandler(defaultHandler : DefaultHandler | undefined){
		this._defaultHandler = defaultHandler;
		return this;
	}

	setDefaultLogger(logger : Logger | undefined){
		this._defaultRouteOptions = {...this._defaultRouteOptions, logger};
		return this;
	}

	setDefaultHTTPErrorHandler(httpErrorHandler : HTTPErrorHandler | undefined){
		this._defaultRouteOptions = {...this._defaultRouteOptions, httpErrorHandler};
		return this;
	}

	setDefaultBodyParser(bodyParser : BodyParser<any> | undefined){
		this._defaultRouteOptions = {...this._defaultRouteOptions, bodyParser};
		return this;
	}

	setDefaultResponseSerializer(responseSerializer : ResponseSerializer<any> | undefined){
		this._defaultRouteOptions = {...this._defaultRouteOptions, responseSerializer};
		return this;
	}

	/**
	 * Run a DocGen module over the registered routes
	 * @param docgen
	 */
	document(docgen : DocGen){
		return docgen.toDocumentation(this._httproutes, this._wsroutes);
	}

	/**
	 * Spins up a single ephemeral instance mounting this router's routes, to fire real
	 * requests against them without binding a real port. See docs/testing.md.
	 */
	test() : RouteTester {
		return new RouteTester(this);
	}




// ──────────────────────────
// │ 🌐 HTTP HELPER METHOD
// ──────────────────────────

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	any<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : Handlers<InferContextTypes<S>, EC>) : this;
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : Handlers<CT, EC>) : this;
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : Handlers<CT, EC>) : this;
	any<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...Handlers<CT, EC>] | Handlers<CT, EC>) { 
		return this.add<CT, EC>('any', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	del<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : DELHandlers<InferContextTypes<S>, EC>) : this;
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : DELHandlers<CT, EC>) : this;
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : DELHandlers<CT, EC>) : this;
	del<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...DELHandlers<CT, EC>] | DELHandlers<CT, EC>) { 
		return this.add<CT, EC>('del', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	get<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : GETHandlers<InferContextTypes<S>, EC>) : this;
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : GETHandlers<CT, EC>) : this;
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : GETHandlers<CT, EC>) : this;
	get<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...GETHandlers<CT, EC>] | GETHandlers<CT, EC>) {
		return this.add<CT, EC>('get', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	sse<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : GETHandlers<InferContextTypes<S>, EC>) : this;
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : GETHandlers<CT, EC>) : this;
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : GETHandlers<CT, EC>) : this;
	sse<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...GETHandlers<CT, EC>] | GETHandlers<CT, EC>) {
		const options : HTTPRouteOptions | undefined = typeof args[0] === "function" ? undefined : args.shift() as HTTPRouteOptions;
		const handlers : GETHandlers<CT, EC> = args as GETHandlers<CT, EC>;
		
		if(options)
			return this.add<CT, EC>('get', pattern, options, (c : any) => c.sustain(), ...handlers);
		else
			return this.add<CT, EC>('get', pattern, (c : any) => c.sustain(), ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	head<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : HEADHandlers<InferContextTypes<S>, EC>) : this;
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : HEADHandlers<CT, EC>) : this;
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : HEADHandlers<CT, EC>) : this;
	head<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...HEADHandlers<CT, EC>] | HEADHandlers<CT, EC>) {
		return this.add<CT, EC>('head', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	options<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : OPTIONSHandlers<InferContextTypes<S>, EC>) : this;
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : OPTIONSHandlers<CT, EC>) : this;
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : OPTIONSHandlers<CT, EC>) : this;
	options<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...OPTIONSHandlers<CT, EC>] | OPTIONSHandlers<CT, EC>) {
		return this.add<CT, EC>('options', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	post<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : POSTHandlers<InferContextTypes<S>, EC>) : this;
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : POSTHandlers<CT, EC>) : this;
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : POSTHandlers<CT, EC>) : this; 
	post<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...POSTHandlers<CT, EC>] | POSTHandlers<CT, EC>) { 
		return this.add<CT, EC>('post', pattern, ...args);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	patch<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : PATCHHandlers<InferContextTypes<S>, EC>) : this;
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : PATCHHandlers<CT, EC>) : this;
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : PATCHHandlers<CT, EC>) : this;
	patch<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...PATCHHandlers<CT, EC>] | PATCHHandlers<CT, EC>) {
		return this.add<CT, EC>('patch', pattern, ...args);
	}

	/**
	 *
	 * @param pattern
	 * @param handlers
	 * @returns
	 */
	put<S extends Schemas, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas : S}, ...handlers : PUTHandlers<InferContextTypes<S>, EC>) : this;
	put<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, options : HTTPRouteOptions & {schemas? : undefined}, ...handlers : PUTHandlers<CT, EC>) : this;
	put<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...handlers : PUTHandlers<CT, EC>) : this;
	put<CT extends ContextTypes = DefaultContextTypes, EC extends any = DefaultExtendContext>(pattern: string, ...args : [HTTPRouteOptions, ...PUTHandlers<CT, EC>] | PUTHandlers<CT, EC>) {
		return this.add<CT, EC>('put', pattern, ...args);
	}
}