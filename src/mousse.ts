import {App as uWSApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket as uWSListenSocket, us_listen_socket_close as uWSListenSocketClose, WebSocket as uWSWebSocket} from 'uWebSockets.js';
import { ErrorHandler } from './errorhandler';
import { HTTPRouteMethod, Middleware, RouteMethod, Router } from './router';
import { ActiveContextHandler, Context, ContextTypes, PassiveContextHandler } from './context';
import { joinUri } from './utils';
import { WebSocketOptions, WebSocket } from './websocket';
export type MousseOptions = uWSAppOptions & {

}

export class Mousse{

	private _app : uWSTemplatedApp;

	private _errorHandler : ErrorHandler | undefined;

	private _defaultHandler : ActiveContextHandler<any> | undefined;

	private _middlewares : Middleware<any>[];

	private _listenSocket : uWSListenSocket | undefined;

	contructor(options? : uWSAppOptions){
		this._app = uWSApp(options);
	}

	/**
	 * Register a new route to uWebsocket App with an async handler iterating over matching middleware
	 * @param method 
	 * @param pattern 
	 * @param handler 
	 */
	private registerHTTP(method : HTTPRouteMethod, pattern : string, handler : ActiveContextHandler<any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? [];

		this._app[method](pattern, async (ures, ureq) => {
			const context = new Context(ureq, ures, pattern, params, this, false);
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


	private registerWS(pattern : string, options : WebSocketOptions, handler : PassiveContextHandler<any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? [];
		let wrappedWebSocket : WebSocket;
		let context : Context<any>;

		this._app.ws(pattern, {
			upgrade : async (ures, ureq, wsc) => {
				// Create an upgradable context
				context = new Context(ureq, ures, pattern, params, this, true, wsc);
				try{
					// Middleware on this route are still applied
					for (let i = 0; i < appliedMiddlewares.length; i++) 
						await appliedMiddlewares[i].handler(context);
					
					// Handler might be default one which won't do anything
					await handler(context);

					// Upgrade
					if(!context.ended && context.upgradable && context.upgraded)
						context.upgrade();
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			open: (ws) => {
				try{
					wrappedWebSocket = new WebSocket(ws as uWSWebSocket<undefined>, options);
					if(context.wsEventHandlers['open'])
						context.wsEventHandlers['open'](wrappedWebSocket);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			message: (ws, message, isBinary) => {
				try{
					if(context.wsEventHandlers['message'])
						context.wsEventHandlers['message'](wrappedWebSocket, message, isBinary);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}				
			},
			ping: (ws, message) => {
				try{
					if(context.wsEventHandlers['ping'])
						context.wsEventHandlers['ping'](wrappedWebSocket, message);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			pong: (ws, message) => {
				try{
					if(context.wsEventHandlers['pong'])
						context.wsEventHandlers['pong'](wrappedWebSocket, message);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			dropped: (ws, message, isBinary) => {
				try{
					if(context.wsEventHandlers['dropped'])
						context.wsEventHandlers['dropped'](wrappedWebSocket, message, isBinary);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			drain: (ws) => {
				try{
					wrappedWebSocket.drain();
					if(context.wsEventHandlers['drain'])
						context.wsEventHandlers['drain'](wrappedWebSocket);
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
				}
			},
			close: (ws, code, message) => {
				try{
					if(context.wsEventHandlers['close'])
						context.wsEventHandlers['close'](wrappedWebSocket, code, message);				
				} catch(e) {
					if(this._errorHandler)
						this._errorHandler(e, context);
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
	setDefaultHandler(defaultHandler : ActiveContextHandler<any> | undefined){
		this._defaultHandler = defaultHandler;

		return this;
	}


	use<CT extends ContextTypes>(pattern : string, ...handlers : Array<PassiveContextHandler<CT> | Router<CT>>){
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
					this.registerHTTP(route.method, joinUri(pattern, route.pattern), route.handler);
				}

				// TODO REgister also ws
			}
			else
				this._middlewares.push({pattern, handler : handlers[i] as PassiveContextHandler<CT>})
		}
	}

	// TODO ws method similar to add

	add<CT extends ContextTypes>(method : HTTPRouteMethod, pattern : string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]){
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this.registerHTTP(method, pattern, handlers[0]);
		else{
			// Last one is always an ActiveContextHandler
			const handler : ActiveContextHandler<CT> = handlers.pop() as ActiveContextHandler<CT>;
			this.use(pattern, ...(handlers as PassiveContextHandler<CT>[]));
			this.registerHTTP(method, pattern, handler);
		}

		return this;
	}

	any<CT extends ContextTypes>(pattern : string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]){
		return this.add<CT>('any', pattern, ...handlers);
	}

	del<CT extends ContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('del', pattern, ...handlers);
	}
	get<CT extends ContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('get', pattern, ...handlers);
	}
	head<CT extends ContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('head', pattern, ...handlers);
	}
	options<CT extends ContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) {
		return this.add<CT>('options', pattern, ...handlers);
	}
	post<CT extends ContextTypes>(pattern: string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]) { 
		return this.add<CT>('post', pattern, ...handlers);
	}

	listen(port : number, callback? : (listenSocket : uWSListenSocket | false) => void | Promise<void>){
		if(this._listenSocket)
			throw new Error('Mousse Instance is already listening');
		
		if(this._defaultHandler)
			this.registerHTTP('any', '/*', this._defaultHandler);
		
		this._app.listen(port, (ls) => {
			this._listenSocket = ls;
			if(callback)
				callback(ls);
		});
	}

	stop(){
		if(this._listenSocket){
			uWSListenSocketClose(this._listenSocket)
			this._listenSocket = undefined;
		}
	}
}