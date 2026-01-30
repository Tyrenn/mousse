import { ContextTypes, MiddlewareHandler } from "context/index.js";

export type WSRouteOptions = {
	maxBackPressure? : number;
}

export interface WSRoute<CT extends ContextTypes, EC extends any = {}>{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
	registered : boolean;

	options? : WSRouteOptions;
}
