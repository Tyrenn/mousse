import { ContextTypes, Handler } from "context.js";

export type HTTPRouteMethod = 'any' | 'del' | 'head' | 'get' | 'options' | 'post' | 'put' | 'patch';

export interface HTTPRouteOptions {
	schemas ? : {Body? : any, Response? : any};
//	serializer? : Serializer<any>;
}

export class HTTPRoute<CT extends ContextTypes, EC extends any = {}> {
	method : HTTPRouteMethod;
	pattern: string;
	handler: Handler<CT, EC>;
	registered : boolean = false;

	options? : HTTPRouteOptions;

	constructor(method : HTTPRouteMethod, pattern : string, handler : Handler<CT, EC>, options? : HTTPRouteOptions){
		this.method = method;
		this.pattern = pattern;
		this.handler = handler;

		this.options = options;
	}
};