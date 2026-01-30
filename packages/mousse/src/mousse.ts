import {App as uWSApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket as uWSListenSocket, us_listen_socket_close as uWSListenSocketClose, RecognizedString, us_socket_local_port as uWSSocketLocalPort} from 'uWebSockets.js';
import { Middleware, Router } from './router.js';
import { Handler, Context, ContextTypes, WebSocket, DefaultBodyParser, DefaultResponseSerializer} from './context/index.js';
import { Logger } from './route/logger.js';
import { HTTPRoute } from 'route/http.js';
import { WSRoute } from 'route/ws.js';

export type MousseOptions = uWSAppOptions & {
	logger? : Logger;
}



/**
 * Mousse app directly register routes in the uWS app whereas Router save routes inside array.
 */
export class Mousse<DefaultContextTypes extends ContextTypes = any, DefaultExtendContext extends any = {}> extends Router<DefaultContextTypes, DefaultExtendContext>{

	private _app : uWSTemplatedApp;

	private _defaultHandler : Handler<any, any> | undefined;

	private _listenSocket : uWSListenSocket | undefined;


	constructor(options? : MousseOptions){

		super();

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
	}


	/**
	 * Register a new route to uWebsocket App with an async handler iterating over matching middleware
*	Middleware's application depends on registration time. Only already registered middlewares are applied to a Route. 
*
	 * @param method
	 * @param pattern
	 * @param handler
	 */
	private _registerHTTP(route : HTTPRoute<any, any>){
		const appliedMiddlewares : Middleware<any>[] = [];
		
		// Populate appliedMiddlewares based on their pattern
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || route.pattern.startsWith(this._middlewares[i].pattern as string))
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = route.pattern.match(/:[\w]+/g) ?? []

		this._app[route.method](route.pattern, async (ures, ureq) => {
			// The body is built in a promise handled by here
			const context = new Context(this, ureq, ures, route.pattern, params,
				route.bodyParser ?? new DefaultBodyParser(),
				route.responseSerializer ?? new DefaultResponseSerializer(),
				route?.logger,
				{method : route.method, schemas : route.schemas}
			);
			let res : any = undefined;

			try{
				for (let i = 0; i < appliedMiddlewares.length; i++)
					await appliedMiddlewares[i].handler(context);

				res = await route.handler(context);
			} catch(e) {
				if(route.httpErrorHandler)
					route.httpErrorHandler.handle(e, context);
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

		route.registered = true;
	}

	/**
	 *
	 * @param pattern
	 * @param handler
	 * @param options
	 */
	private _registerWS(route : WSRoute<any, any>){
		const appliedMiddlewares : Middleware<any>[] = [];

		// Populate appliedMiddlewares based on their pattern
		for (let i = 0; i < this._middlewares.length; i++) {
			if (!this._middlewares[i].pattern || route.pattern.startsWith(this._middlewares[i].pattern as string))
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = route.pattern.match(/:[\w]+/g) ?? [];

		this._app.ws(route.pattern, {
			upgrade : async (ures, ureq, wsc) => {
				// Create an upgradable context
				const context = new Context(this, ureq, ures, route.pattern, params, 
					route.bodyParser ?? new DefaultBodyParser(),
					route.responseSerializer ?? new DefaultResponseSerializer(),
					route?.logger,
					undefined, {socket : wsc, maxBackPressure : route?.maxBackPressure});
				try{
					// Middleware on this route are still applied
					for (let i = 0; i < appliedMiddlewares.length; i++)
						await appliedMiddlewares[i].handler(context);

					// Handler might be default one which won't do anything
					await route.handler(context);

					// Upgrade (will populate user data with useful data)
					if(!context.ended && context.upgradable && context.upgraded)
						context.upgrade();
				} catch(e) {
					if(route.httpErrorHandler)
						route.httpErrorHandler.handle(e, context);
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
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
			message: (ws: WebSocket, message, isBinary) => {
				try{
					const handler = ws.getUserData().handlers.message;
					if(handler)
						handler(ws, message, isBinary);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
			ping: (ws, message) => {
				try{
					const handler = ws.getUserData().handlers.ping;
					if(handler)
						handler(ws, message);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
			pong: (ws, message) => {
				try{
					const handler = ws.getUserData().handlers.pong;
					if(handler)
						handler(ws, message);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
			dropped: (ws, message, isBinary) => {
				try{
					const handler = ws.getUserData().handlers.dropped;
					if(handler)
						handler(ws, message, isBinary);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
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
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
			close: (ws : WebSocket, code, message) => {
				try{
					const handler = ws.getUserData().handlers.close;
					if(handler)
						handler(ws, code, message);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
				}
			},
		});

		route.registered = true;
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



	register(){
		const httproutes = this._httproutes.filter(r => !r.registered);
		const wsroutes = this._wsroutes.filter(r => !r.registered);

		for(let j = 0; j < httproutes.length; j++)
			this._registerHTTP(this._httproutes[j]);

		for(let j = 0; j < wsroutes.length; j++)
			this._registerWS(this._wsroutes[j]);
	}



	/**
	 *
	 * @param port
	 * @param callback
	 */
	listen(port : number, callback? : (listenSocket : uWSListenSocket | false, port : number) => void | Promise<void>){
		if(this._listenSocket)
			throw new Error('Mousse Instance is already listening');

		this.register();

		if(this._defaultHandler)
			this._registerHTTP({method : 'any', pattern : '/*', handler : this._defaultHandler, registered : false});

		this._app.listen(port, (ls) => {
			this._listenSocket = ls;
			if(callback)
				callback(ls, uWSSocketLocalPort(ls));
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
