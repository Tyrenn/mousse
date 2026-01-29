import { ContextTypes, MiddlewareHandler } from "context.js";

export type WSRouteOptions = {
	maxBackPressure? : number;
}

export class WSRoute<CT extends ContextTypes, EC extends any = {}>{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
	registered : boolean = false;

	options? : WSRouteOptions;

	constructor(pattern : string, handler : MiddlewareHandler<CT, EC>, options? : WSRouteOptions){
		this.pattern = pattern;
		this.handler = handler;
			
		this.options = options;
	}
}
