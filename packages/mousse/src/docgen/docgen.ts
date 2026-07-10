import { HTTPRoute, WSRoute } from '../route.js';
import { DocSchemaTranslator } from './docSchemaTranslator.js';

export interface DocGen{

	/**
	 * Translate routes to a documentation output (html files, openapi json...)
	 * @param httproutes
	 * @param wsroutes
	 * @param translators DocSchemaTranslator registry of the router generateDoc was called on
	 */
	toDocumentation(httproutes : HTTPRoute<any, any>[], wsroutes : WSRoute<any, any>[], translators? : Map<string, DocSchemaTranslator>) : void | Promise<void>;
}
