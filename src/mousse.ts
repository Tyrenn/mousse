import {App as uWSApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket as uWSListenSocket, us_listen_socket_close as uWSListenSocketClose, RecognizedString} from 'uWebSockets.js';
import { ErrorHandler, WebsocketEventErrorHandler } from './errorhandler.js';
import { HTTPRouteMethod, Middleware, RouteMethod, Router, WSRouteOptions } from './router.js';
import { Handler, Context, ContextTypes, WebSocket, WSHandler, MiddlewareHandler, PATCHHandlers, POSTHandlers, PUTHandlers, GETHandlers, Handlers, DELHandlers, OPTIONSHandlers, HEADHandlers } from './context.js';
import { joinUri, parseQuery } from './utils.js';
import { Logger } from './logger.js';
import { Serializer } from './serializer/index.js';
import { DefaultSerializer } from './serializer/default.js';
//import { WebSocketOptions, WebSocket } from './websocket';
export type MousseOptions = uWSAppOptions & {
	logger? : Logger;
	serializer? : Serializer<any>
}

export class Mousse{

	private _app : uWSTemplatedApp;

	private _errorHandler : ErrorHandler | undefined;
	
	private _wsErrorHandler : WebsocketEventErrorHandler | undefined;

	private _defaultHandler : Handler<any, any> | undefined;

	private _middlewares : Middleware<any, any>[] = [];

	private _listenSocket : uWSListenSocket | undefined;

	private _logger : Logger | undefined;

	private _serializer : Serializer<any>;

	constructor(options? : MousseOptions){

		// uWebsocket.js c++ binding are pretty sensitive ! Require to filter any undefined value
		const filteredOptions: uWSAppOptions = {};
		const allowedKeys : Array<keyof uWSAppOptions> = ["key_file_name","cert_file_name","ca_file_name","passphrase","dh_params_file_name","ssl_ciphers","ssl_prefer_low_memory_usage"] as const;

		for (const key of allowedKeys) {
			if (options && options[key] !== undefined) {
				(filteredOptions as any)[key] = options[key]!;
			}
		}
		if(Object.keys(filteredOptions).length > 0)
			this._app = uWSApp(filteredOptions);
		else
			this._app = uWSApp();

		this._logger = options?.logger;
		this._serializer = options?.serializer ?? new DefaultSerializer();
	}


	/**
	 * Register a new route to uWebsocket App with an async handler iterating over matching middleware
	 * @param method 
	 * @param pattern 
	 * @param handler 
	 */
	private _registerHTTP(method : HTTPRouteMethod, pattern : string, handler : Handler<any, any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? []

		this._app[method](pattern, async (ures, ureq) => {
			// The body is built in a promise handled by here
			const context = new Context(this, this._serializer, ureq, ures, pattern, params, false, method);
			let res : any = undefined;

			try{
				for (let i = 0; i < appliedMiddlewares.length; i++) 
					await appliedMiddlewares[i].handler(context);
				
				res = await handler(context);
			} catch(e) {
				if(this._errorHandler)
					this._errorHandler(e, context);
			}
		
			// Handle case the last handler returns something
			if(!context.ended){
				if(!!res && typeof res === "string")
					context.respond(res);
				else if(!!res && typeof res === 'object')
					context.json(res);
				else
					context.respond();
			}
		});
	}

	/**
	 * 
	 * @param pattern 
	 * @param handler 
	 * @param options 
	 */
	private _registerWS(pattern : string, handler : MiddlewareHandler<any, any>, options? : WSRouteOptions){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? [];

		this._app.ws(pattern, {
			upgrade : async (ures, ureq, wsc) => {
				// Create an upgradable context
				const context = new Context(this, this._serializer, ureq, ures, pattern, params, true, undefined, {socket : wsc, maxBackPressure : options?.maxBackPressure});
				try{
					// Middleware on this route are still applied
					for (let i = 0; i < appliedMiddlewares.length; i++) 
						await appliedMiddlewares[i].handler(context);
					
					// Handler might be default one which won't do anything
					await handler(context);

					// Upgrade (will populate user data with useful data)
					if(!context.ended && context.upgradable && context.upgraded)
						context.upgrade();
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			open: (ws: WebSocket) => {
				try{
					// Replace send function by a safer one taking into account backpressure
					ws.send = function (this : WebSocket, message : RecognizedString, isBinary? : boolean, compress? : boolean){
						if (this.getBufferedAmount() < this.getUserData().maxBackPressure)
							return this.send(message, isBinary, compress);
						else
							this.getUserData().bufferQueue.push(message);
						return 0;
					};
					const handler = ws.getUserData().handlers.open;
					if(handler)
						handler(ws);
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
			message: (ws: WebSocket, message, isBinary) => {
				try{
					const handler = ws.getUserData().handlers.message;
					if(handler)
						handler(ws, message, isBinary);
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}				
			},
			ping: (ws, message) => {
				try{
					const handler = ws.getUserData().handlers.ping;
					if(handler)
						handler(ws, message);
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
			pong: (ws, message) => {
				try{
					const handler = ws.getUserData().handlers.pong;
					if(handler)
						handler(ws, message);
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
			dropped: (ws, message, isBinary) => {
				try{
					const handler = ws.getUserData().handlers.dropped;
					if(handler)
						handler(ws, message, isBinary);
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
			drain: (ws : WebSocket) => {
				try{
					while(ws.getUserData().bufferQueue.length > 0 && ws.getBufferedAmount() < ws.getUserData().maxBackPressure) {
						const nextMessage = ws.getUserData().bufferQueue.shift();
						if(nextMessage)
							ws.send(nextMessage);
					}
					const handler = ws.getUserData().handlers.drain;
					if(handler)
						handler(ws);				
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
			close: (ws : WebSocket, code, message) => {
				try{
					const handler = ws.getUserData().handlers.close;
					if(handler)
						handler(ws, code, message);				
				} catch(e) {
					if(this._wsErrorHandler)
						this._wsErrorHandler(e);
				}
			},
		})
	}


	/**
	 * 
	 * @param errorHandler 
	 * @returns 
	 */
	setErrorHandler(errorHandler : ErrorHandler | undefined){
		this._errorHandler = errorHandler;

		return this;
	}


	/**
	 * 
	 * @param defaultHandler 
	 * @returns 
	 */
	setDefaultHandler(defaultHandler : Handler<any> | undefined){
		this._defaultHandler = defaultHandler;

		return this;
	}


	setSerializer(serializer : Serializer<any>){
		this._serializer = serializer;

		return this;
	}


	/**
	 * 
	 * @param logger 
	 * @returns 
	 */
	setLogger(logger : Logger | undefined){
		this._logger = logger;

		return this;
	}


	/**
	 * 
	 * @param data 
	 */
	log(data? : any){
		if(this._logger)
			this._logger.log(data);
	}


	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 */
	use<CT extends ContextTypes, EC extends any = {}>(pattern : string, ...handlers : Array<MiddlewareHandler<CT, EC> | Router<CT, EC>>){
		if(handlers.length < 1)
			throw new Error(`At least one handler is required in 'use' for pattern ${pattern}`);
		
		for(let i = 0; i < handlers.length; i++){
			if(handlers[i] instanceof Router){
				const router = handlers[i] as Router;
				
				// first record middlewares for them to be available when registering routes
				for(let j = 0; j < router.middlewares.length; j++){
					const middleware = router.middlewares[j];
					this._middlewares.push({pattern : joinUri(pattern, middleware.pattern), handler : middleware.handler});
				}
				
				for(let j = 0; j < router.routes.length; j++){
					const route = router.routes[j];
					this._registerHTTP(route.method, joinUri(pattern, route.pattern), route.handler);
				}

				for(let j = 0; j < router.wsroutes.length; j++){
					const wsroute = router.wsroutes[j];
					this._registerWS(joinUri(pattern, wsroute.pattern), wsroute.handler, wsroute.options);
				}
			}
			else
				this._middlewares.push({pattern, handler : handlers[i] as MiddlewareHandler<CT>})
		}
	}

	/**
	 * 
	 * @param pattern 
	 * @param args 
	 * @returns 
	 */
	ws<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...args : [WSRouteOptions | WSHandler<CT, EC>, ...WSHandler<CT, EC>[]]){
		if(args.length < 1){
			this._registerWS(pattern, () => {});
		}
		else if(args.length == 1 && typeof args[0] === "function"){
			this._registerWS(pattern, args[0]);
		}
		else if(args.length == 1 && typeof args[0] !== "function"){
			this._registerWS(pattern, () => {}, args[0]);
		}
		else if(args.length > 1){
			const handler = args.pop() as MiddlewareHandler<CT, EC>;
			const options = typeof args[0] === "function" ? undefined : args.shift() as WSRouteOptions;
			this.use(pattern, ...(args as MiddlewareHandler<CT, EC>[]));
			this._registerWS(pattern, handler, options);
		}

		return this;
	}

	/**
	 * 
	 * @param method 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	add<CT extends ContextTypes, EC extends any = {}>(method : "patch", pattern : string, ...handlers : PATCHHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "post", pattern : string, ...handlers : POSTHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "put", pattern : string, ...handlers : PUTHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "get", pattern : string, ...handlers : GETHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "head", pattern : string, ...handlers : HEADHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "options", pattern : string, ...handlers : OPTIONSHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "del", pattern : string, ...handlers : DELHandlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : "any", pattern : string, ...handlers : Handlers<CT, EC>) : Mousse;
	add<CT extends ContextTypes, EC extends any = {}>(method : HTTPRouteMethod, pattern : string, ...handlers : Handlers<CT, EC>){
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this._registerHTTP(method, pattern, handlers[0]);
		else{
			// Last one is always an ActiveContextHandler
			const handler : Handler<CT, EC> = handlers.pop() as Handler<CT, EC>;
			this.use(pattern, ...(handlers as MiddlewareHandler<CT, EC>[]));
			this._registerHTTP(method, pattern, handler);
		}

		return this;
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	any<CT extends ContextTypes, EC extends any = {}>(pattern : string, ...handlers : Handlers<CT, EC>){
		return this.add<CT, EC>('any', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	del<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : DELHandlers<CT, EC>) { 
		return this.add<CT, EC>('del', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	get<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : GETHandlers<CT, EC>) {
		return this.add<CT, EC>('get', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	sse<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : GETHandlers<CT, EC>) {
		return this.get<CT, EC>(pattern, (c) => c.sustain(), ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	head<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : HEADHandlers<CT, EC>) {
		return this.add<CT, EC>('head', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	options<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : OPTIONSHandlers<CT, EC>) {
		return this.add<CT, EC>('options', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	post<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : POSTHandlers<CT, EC>) { 
		return this.add<CT, EC>('post', pattern, ...handlers);
	}

	/**
	 * 
	 * @param pattern 
	 * @param handlers 
	 * @returns 
	 */
	patch<CT extends ContextTypes, EC extends any = {}>(pattern: string, ...handlers : PATCHHandlers<CT, EC>) { 
		return this.add<CT, EC>('patch', pattern, ...handlers);
	}

	/**
	 * 
	 * @param port 
	 * @param callback 
	 */
	listen(port : number, callback? : (listenSocket : uWSListenSocket | false) => void | Promise<void>){
		if(this._listenSocket)
			throw new Error('Mousse Instance is already listening');
		
		if(this._defaultHandler)
			this._registerHTTP('any', '/*', this._defaultHandler);
		
		this._app.listen(port, (ls) => {
			this._listenSocket = ls;
			if(callback)
				callback(ls);
		});
	}

	/**
	 * 
	 */
	stop(){
		if(this._listenSocket){
			uWSListenSocketClose(this._listenSocket)
			this._listenSocket = undefined;
		}
	}
}