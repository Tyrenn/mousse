import {App as uWSApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket as uWSListenSocket, us_listen_socket_close as uWSListenSocketClose} from 'uWebSockets.js';
import { ErrorHandler } from './errorhandler';
import { HTTPRouteMethod, Middleware, RouteMethod, Router } from './router';
import { ActiveHTTPContextHandler, HTTPContext, HTTPContextTypes, PassiveHTTPContextHandler } from './httpcontext';
import { joinUri } from './utils';
export type MousseOptions = uWSAppOptions & {

}

export class Mousse{

	private _app : uWSTemplatedApp;

	private _errorHandler : ErrorHandler | undefined;

	private _defaultHandler : ActiveHTTPContextHandler<any> | undefined;

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
	private register(method : HTTPRouteMethod, pattern : string, handler : ActiveHTTPContextHandler<any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? [];

		this._app[method](pattern, async (ures, ureq) => {
			const context = new HTTPContext(ureq, ures, pattern, params, this);
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
			if(!context.sent()){
				if(!!res && typeof res === "string")
					context.send(res);
				else if(!!res && typeof res === 'object')
					context.json(res);
				else
					context.send();
			}
		});
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
	setDefaultHandler(defaultHandler : ActiveHTTPContextHandler<any> | undefined){
		this._defaultHandler = defaultHandler;

		return this;
	}


	use<CT extends HTTPContextTypes>(pattern : string, ...handlers : Array<PassiveHTTPContextHandler<CT> | Router<CT>>){
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
					this.register(route.method, joinUri(pattern, route.pattern), route.handler);
				}
			}
			else
				this._middlewares.push({pattern, handler : handlers[i] as PassiveHTTPContextHandler<CT>})
		}
	}


	add<CT extends HTTPContextTypes>(method : HTTPRouteMethod, pattern : string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]){
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this.register(method, pattern, handlers[0]);
		else{
			// Last one is always an ActiveContextHandler
			const handler : ActiveHTTPContextHandler<CT> = handlers.pop() as ActiveHTTPContextHandler<CT>;
			this.use(pattern, ...(handlers as PassiveHTTPContextHandler<CT>[]));
			this.register(method, pattern, handler);
		}

		return this;
	}

	any<CT extends HTTPContextTypes>(pattern : string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]){
		return this.add<CT>('any', pattern, ...handlers);
	}

	del<CT extends HTTPContextTypes>(pattern: string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]) { 
		return this.add<CT>('del', pattern, ...handlers);
	}
	get<CT extends HTTPContextTypes>(pattern: string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]) {
		return this.add<CT>('get', pattern, ...handlers);
	}
	head<CT extends HTTPContextTypes>(pattern: string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]) {
		return this.add<CT>('head', pattern, ...handlers);
	}
	options<CT extends HTTPContextTypes>(pattern: string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]) {
		return this.add<CT>('options', pattern, ...handlers);
	}
	post<CT extends HTTPContextTypes>(pattern: string, ...handlers : [...PassiveHTTPContextHandler<CT>[], ActiveHTTPContextHandler<CT>]) { 
		return this.add<CT>('post', pattern, ...handlers);
	}

	listen(port : number, callback? : (listenSocket : uWSListenSocket | false) => void | Promise<void>){
		if(this._listenSocket)
			throw new Error('Mousse Instance is already listening');
		
		if(this._defaultHandler)
			this.register('any', '/*', this._defaultHandler);
		
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