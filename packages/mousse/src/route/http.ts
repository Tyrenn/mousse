import { ContextTypes, Handler } from "context/index.js";
import { BodyParser } from "../context/bodyparser.js";
import { ResponseSerializer } from "../context/responseserializer.js";
import { HTTPErrorHandler, WSErrorHandler } from "./errorhandler.js";
import { Logger } from "./logger.js";

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