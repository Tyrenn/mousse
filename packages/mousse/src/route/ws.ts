import { ContextTypes, MiddlewareHandler } from "context/index.js";
import { Logger } from "./logger.js";
import { WSErrorHandler } from "./errorhandler.js";

export type WSRouteOptions = {
	maxBackPressure? : number;

	wsErrorHandler? : WSErrorHandler;

	logger? : Logger;
}

export interface WSRoute<CT extends ContextTypes, EC extends any = {}> extends WSRouteOptions{
	pattern : string;
	handler: MiddlewareHandler<CT, EC>;
	registered : boolean;
}
