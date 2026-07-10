import {App as uWSApp, SSLApp as uWSSSLApp, TemplatedApp as uWSTemplatedApp, AppOptions as uWSAppOptions, us_listen_socket as uWSListenSocket, us_listen_socket_close as uWSListenSocketClose, RecognizedString, us_socket_local_port as uWSSocketLocalPort} from 'uWebSockets.js';
import { Middleware, Router } from './router.js';
import { Context, ContextTypes, WebSocket, WSContext} from './context.js';
import { HTTPRoute, WSRoute } from './route.js';
import { DefaultBodyParser } from './module/bodyparser.js';
import { DefaultResponseSerializer } from './module/responseserializer.js';
import { matchPattern } from './utils.js';
import { SchemaValidationError } from './schema.js';

export type MousseOptions = uWSAppOptions;



/**
 * Mousse app directly register routes in the uWS app whereas Router save routes inside array.
 */
export class Mousse<DefaultContextTypes extends ContextTypes = any, DefaultExtendContext extends any = {}> extends Router<DefaultContextTypes, DefaultExtendContext>{

	private _app : uWSTemplatedApp;

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
		// uWS only enables TLS through SSLApp, plain App silently ignores SSL options
		if(filteredOptions.key_file_name && filteredOptions.cert_file_name)
			this._app = uWSSSLApp(filteredOptions);
		else if(Object.keys(filteredOptions).length > 0)
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
			if (matchPattern(this._middlewares[i].pattern, route.pattern))
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

			// Any route error ends here : never an implicit 200
			const handleError = async (e : any) => {
				if(route.httpErrorHandler){
					await route.httpErrorHandler.handle(e, context);
				}
				else if(e instanceof SchemaValidationError){
					// Invalid request data -> 400 with issues, invalid response data -> 500
					if(e.part === 'response')
						console.error(e);
					if(!context.ended && !context.sustained){
						if(e.part === 'response')
							context.status(500).respond();
						else
							context.status(400).header('content-type', 'application/json')
								.respond(JSON.stringify({error : `Invalid ${e.part}`, issues : e.issues}));
					}
					return;
				}
				else if(route.logger)
					route.logger.log(e);
				else
					console.error(e);

				if(!context.ended && !context.sustained)
					context.status(500).respond();
			};

			try{
				// Params and query are validated against route schemas before anything runs
				await context.applySchemas();

				for (let i = 0; i < appliedMiddlewares.length; i++)
					await appliedMiddlewares[i].handler(context);

				// Route scoped middlewares run after router level ones
				if(route.middlewares)
					for (let i = 0; i < route.middlewares.length; i++)
						await route.middlewares[i](context);

				res = await route.handler(context);
			} catch(e) {
				await handleError(e);
				return;
			}

			// Handle case the last handler returns something
			if(!context.ended && !context.sustained){
				try{
					if(typeof res === "string")
						context.respond(res);
					else if(!!res && typeof res === 'object')
						context.json(res);
					else
						context.respond();
				} catch(e) {
					// json() may throw on response schema validation
					await handleError(e);
				}
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
			if (matchPattern(this._middlewares[i].pattern, route.pattern))
				appliedMiddlewares.push(this._middlewares[i]);
		}

		// Match params one time to avoid doing it in realtime everytime we build a context
		const params = route.pattern.match(/:[\w]+/g) ?? [];

		this._app.ws(route.pattern, {
			upgrade : async (ures, ureq, wsc) => {
				// Create an upgradable context : middlewares run on the HTTP upgrade request
				// and can reject the upgrade by responding
				const context = new Context(this, ureq, ures, route.pattern, params,
					route.bodyParser ?? new DefaultBodyParser(),
					route.responseSerializer ?? new DefaultResponseSerializer(),
					route?.logger,
					undefined, {socket : wsc, maxBackPressure : route?.maxBackPressure});
				try{
					for (let i = 0; i < appliedMiddlewares.length; i++)
						await appliedMiddlewares[i].handler(context);

					if(route.middlewares)
						for (let i = 0; i < route.middlewares.length; i++)
							await route.middlewares[i](context);

					// No middleware responded : upgrade. The route handler runs at open, connected.
					if(!context.ended && context.upgradable && !context.upgraded)
						context.upgrade();
				} catch(e) {
					if(route.httpErrorHandler)
						await route.httpErrorHandler.handle(e, context);
					else
						console.error(e);

					if(!context.ended)
						context.status(500).respond();
				}
			},
			open: (ws: WebSocket) => {
				try{
					// Replace send function by a safer one taking into account backpressure
					const originalSend = ws.send.bind(ws);
					ws.send = (message : RecognizedString, isBinary? : boolean, compress? : boolean) => {
						if (ws.getBufferedAmount() < ws.getUserData().maxBackPressure)
							return originalSend(message, isBinary, compress);

						ws.getUserData().bufferQueue.push(message);
						return 0;
					};

					// Open listeners possibly registered by upgrade middlewares run first
					const openHandler = ws.getUserData().handlers.open;
					if(openHandler)
						openHandler(ws);

					// Then the route handler, on an already connected context
					const result = route.handler(new WSContext(ws, this, route.logger) as any);
					if(result instanceof Promise)
						result.catch((e) => {
							if(route.wsErrorHandler)
								route.wsErrorHandler.handle(e);
							else
								console.error(e);
						});
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
					else
						console.error(e);
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
					else
						console.error(e);
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
					else
						console.error(e);
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
					else
						console.error(e);
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
					else
						console.error(e);
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
					else
						console.error(e);
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
					else
						console.error(e);
				}
			},
			subscription: (ws : WebSocket, topic, newCount, oldCount) => {
				try{
					const handler = ws.getUserData().handlers.subscription;
					if(handler)
						handler(ws, topic, newCount, oldCount);
				} catch(e) {
					if(route.wsErrorHandler)
						route.wsErrorHandler.handle(e);
					else
						console.error(e);
				}
			},
		});

		route.registered = true;
	}

	register(){
		const httproutes = this._httproutes.filter(r => !r.registered);
		const wsroutes = this._wsroutes.filter(r => !r.registered);

		for(let j = 0; j < httproutes.length; j++)
			this._registerHTTP(httproutes[j]);

		for(let j = 0; j < wsroutes.length; j++)
			this._registerWS(wsroutes[j]);
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

		if(this._defaultHandler){
			// Arrow wrapper keeps the defaultHandler 'this' binding
			const defaultHandler = this._defaultHandler;
			this._registerHTTP(new HTTPRoute({...this._defaultRouteOptions, method : 'any', pattern : '/*', handler : (c) => defaultHandler.handle(c)}));
		}

		this._app.listen(port, (ls) => {
			this._listenSocket = ls;
			if(callback)
				callback(ls, uWSSocketLocalPort(ls));
		});
	}

	/**
	 * Publish a message to every socket subscribed to the topic, across all ws routes.
	 * Unlike WSContext.publish, the sender (if any) receives it too.
	 */
	publish(topic : RecognizedString, message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this._app.publish(topic, message, isBinary, compress);
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
