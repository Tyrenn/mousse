

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

export interface HTTPRoute<CT extends ContextTypes, EC extends any = {}> extends HTTPRouteOptions{
	method : HTTPRouteMethod;
	pattern: string;
	handler: Handler<CT, EC>;
	registered : boolean;
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

export interface WSRoute<CT extends ContextTypes, EC extends any = {}> extends WSRouteOptions{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
	registered : boolean;
}
