import { HTTPRoute, WSRoute } from "../route.js";


export interface DocGen{

	/**
	 * Translate routes to a documentation output (html files, openapi json...)
	 * @param httproutes
	 * @param wsroutes
	 */
	toDocumentation(httproutes : HTTPRoute<any, any>[], wsroutes : WSRoute<any, any>[]) : void | Promise<void>;
}
