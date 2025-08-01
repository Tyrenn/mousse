import {App as uWSApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket} from 'uWebSockets.js';
import { ErrorHandler } from './errorhandler';
import { HTTPRouteMethod, Middleware, RouteMethod, Router } from './router';
import { ActiveContextHandler, Context, ContextTypes, PassiveContextHandler } from './context';
import { joinUri } from './utils';
export type MousseOptions = uWSAppOptions & {

}

export class Mousse{

	private _app : uWSTemplatedApp;

	private _errorHandler : ErrorHandler | undefined;

	private _defaultHandler : ActiveContextHandler<any> | undefined;

	private _middlewares : Middleware<any>[];

	contructor(options? : uWSAppOptions){
		this._app = uWSApp(options);
	}

	/**
	 * Register a new route to uWebsocket App with an async handler iterating over matching middleware
	 * @param method 
	 * @param pattern 
	 * @param handler 
	 */
	private register(method : HTTPRouteMethod, pattern : string, handler : ActiveContextHandler<any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern 
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || pattern.startsWith(this._middlewares[i].pattern as string)) 
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = pattern.match(/:[\w]+/g) ?? [];

		this._app[method](pattern, async (ures, ureq) => {
			const context = new Context(ureq, ures, pattern, params, this);
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
					this.register(route.method, joinUri(pattern, route.pattern), route.handler);
				}
			}
			else
				this._middlewares.push({pattern, handler : handlers[i] as PassiveContextHandler<CT>})
		}
	}


	add<CT extends ContextTypes>(method : HTTPRouteMethod, pattern : string, ...handlers : [...PassiveContextHandler<CT>[], ActiveContextHandler<CT>]){
		if(handlers.length < 1)
			throw new Error(`Must provide at least one handler in route ${pattern} for method ${method}`);

		if(handlers.length == 1)
			this.register(method, pattern, handlers[0]);
		else{
			// Last one is always an ActiveContextHandler
			const handler : ActiveContextHandler<CT> = handlers.pop() as ActiveContextHandler<CT>;
			this.use(pattern, ...(handlers as PassiveContextHandler<CT>[]));
			this.register(method, pattern, handler);
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

	listen(port : number, callback? : (listenSocket : us_listen_socket | false) => void | Promise<void>){
		if(this._defaultHandler)
			this.register('any', '/*', this._defaultHandler);
		
		this._app.listen(port, callback ?? (() => {}));
	}
}