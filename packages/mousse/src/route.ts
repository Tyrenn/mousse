

import { ContextTypes } from "context.js";
import { Handler, MiddlewareHandler } from "handler.js";
import { BodyParser } from "module/bodyparser.js";
import { HTTPErrorHandler, WSErrorHandler } from "module/errorhandler.js";
import { Logger } from "module/logger.js";
import { ResponseSerializer } from "module/responseserializer.js";

export type RouteMethod =  HTTPRouteMethod | 'ws';



// ──────────────────────────
// │ 🌐 HTTP
// ──────────────────────────

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export interface HTTPRouteOptions {
	schemas ? : {Body? : any, Response? : any};

	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;

	httpErrorHandler? : HTTPErrorHandler;
	logger? : Logger;

	// ERROR HANDLER ?
	// Logger ??
}

export class HTTPRoute<CT extends ContextTypes, EC extends any = {}> {
	method : HTTPRouteMethod;
	pattern: string;
	handler: Handler<CT, EC>;
	registered : boolean = false;


	schemas? : {Body? : any, Response? : any};
	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;
	httpErrorHandler? : HTTPErrorHandler;
	logger? : Logger;


	constructor(options : {method : HTTPRouteMethod, pattern : string, handler : Handler<CT, EC>} & HTTPRouteOptions){
		this.method = options.method;
		this.pattern = options.pattern;
		this.handler = options.handler;

		this.schemas = options.schemas;
		
		this.bodyParser = options.bodyParser;
		this.responseSerializer = options.responseSerializer;
		
		this.httpErrorHandler = options.httpErrorHandler;

		this.logger = options.logger;
	}


	// TEST method logic ? Depend on the route context type ! Especially method !

};





// ──────────────────────────
// │ ⚡ WS
// ──────────────────────────

export type WSRouteOptions = {
	maxBackPressure? : number;

	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;

	httpErrorHandler? : HTTPErrorHandler;
	wsErrorHandler? : WSErrorHandler;

	logger? : Logger;
}


export class WSRoute<CT extends ContextTypes, EC extends any = {}> {
	pattern: string;
	handler: MiddlewareHandler<CT, EC>;
	registered : boolean = false;


	maxBackPressure? : number;
	bodyParser? : BodyParser<any>;
	responseSerializer? : ResponseSerializer<any>;
	httpErrorHandler? : HTTPErrorHandler;
	wsErrorHandler? : WSErrorHandler;
	logger? : Logger;


	constructor(options : {pattern : string, handler : MiddlewareHandler<CT, EC>} & WSRouteOptions){
		this.pattern = options.pattern;
		this.handler = options.handler;
		
		this.maxBackPressure = options.maxBackPressure;

		this.bodyParser = options.bodyParser;
		this.responseSerializer = options.responseSerializer;
		
		this.httpErrorHandler = options.httpErrorHandler;
		this.wsErrorHandler = options.wsErrorHandler;

		this.logger = options.logger;
	}

};
