

import { ContextTypes, RequestHook } from "./context.js";
import { Handler, MiddlewareHandler, WSHandler } from "./handler.js";
import { BodyParser } from "./module/bodyparser.js";
import { HTTPErrorHandler, WSErrorHandler } from "./module/errorhandler.js";
import { Logger } from "./module/logger.js";
import { RateLimiter } from "./module/ratelimiter.js";
import { ResponseSerializer } from "./module/responseserializer.js";
import { Schemas } from "./schema.js";

/**
 * Route documentation metadata, consumed by DocGen modules
 */
export type RouteDoc = {
	summary? : string;
	description? : string;
	// First tag is used as the route group in generated documentation
	tags? : string[];
};

// ──────────────────────────
// │ 🌐 HTTP
// ──────────────────────────

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export interface HTTPRouteOptions {
	schemas? : Schemas;
	doc? : RouteDoc;

	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;

	// Maximum request body size in bytes, 1 MiB by default. Larger bodies are answered 413
	bodyLimit? : number;

	// Status of invalid request data (body, query, params) responses, 400 by default
	validationErrorStatus? : number;

	// Runs before anything of the request is analysed, false disables the one inherited from the router
	rateLimiter? : RateLimiter | false;

	// Hooks dedicated to this route only, applied after the router level ones and before the rate limiter
	onRequest? : RequestHook | RequestHook[];

	httpErrorHandler? : HTTPErrorHandler;
	logger? : Logger;

}

export class HTTPRoute<CT extends ContextTypes, CE extends any = {}> {
	method : HTTPRouteMethod;
	pattern: string;
	handler: Handler<CT, CE>;
	// Middlewares dedicated to this route only, applied after the router level ones
	middlewares? : MiddlewareHandler<any, any>[];
	registered : boolean = false;


	schemas? : Schemas;
	doc? : RouteDoc;
	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;
	bodyLimit? : number;
	validationErrorStatus? : number;
	rateLimiter? : RateLimiter | false;
	onRequest? : RequestHook | RequestHook[];
	httpErrorHandler? : HTTPErrorHandler;
	logger? : Logger;


	constructor(options : {method : HTTPRouteMethod, pattern : string, handler : Handler<CT, CE>, middlewares? : MiddlewareHandler<any, any>[]} & HTTPRouteOptions){
		this.method = options.method;
		this.pattern = options.pattern;
		this.handler = options.handler;
		this.middlewares = options.middlewares;

		this.schemas = options.schemas;
		this.doc = options.doc;

		this.bodyParser = options.bodyParser;
		this.responseSerializer = options.responseSerializer;
		this.bodyLimit = options.bodyLimit;
		this.validationErrorStatus = options.validationErrorStatus;
		this.rateLimiter = options.rateLimiter;
		this.onRequest = options.onRequest;

		this.httpErrorHandler = options.httpErrorHandler;

		this.logger = options.logger;
	}
};





// ──────────────────────────
// │ ⚡ WS
// ──────────────────────────

export type WSRouteOptions = {
	maxBackPressure? : number;

	doc? : RouteDoc;

	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;

	// Runs on the upgrade request before its middlewares, false disables the one inherited from the router
	rateLimiter? : RateLimiter | false;

	// Hooks dedicated to this route only, applied after the router level ones and before the rate limiter
	onRequest? : RequestHook | RequestHook[];

	httpErrorHandler? : HTTPErrorHandler;
	wsErrorHandler? : WSErrorHandler;

	logger? : Logger;
}


export class WSRoute<CT extends ContextTypes, CE extends any = {}> {
	pattern: string;
	// Handler of the established connection ; middlewares run on the HTTP upgrade request
	handler: WSHandler<CT, CE>;
	// Middlewares dedicated to this route only, applied after the router level ones
	middlewares? : MiddlewareHandler<any, any>[];
	registered : boolean = false;


	maxBackPressure? : number;
	doc? : RouteDoc;
	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;
	rateLimiter? : RateLimiter | false;
	onRequest? : RequestHook | RequestHook[];
	httpErrorHandler? : HTTPErrorHandler;
	wsErrorHandler? : WSErrorHandler;
	logger? : Logger;


	constructor(options : {pattern : string, handler : WSHandler<CT, CE>, middlewares? : MiddlewareHandler<any, any>[]} & WSRouteOptions){
		this.pattern = options.pattern;
		this.handler = options.handler;
		this.middlewares = options.middlewares;

		this.maxBackPressure = options.maxBackPressure;
		this.doc = options.doc;

		this.bodyParser = options.bodyParser;
		this.responseSerializer = options.responseSerializer;

		this.rateLimiter = options.rateLimiter;
		this.onRequest = options.onRequest;

		this.httpErrorHandler = options.httpErrorHandler;
		this.wsErrorHandler = options.wsErrorHandler;

		this.logger = options.logger;
	}

};
