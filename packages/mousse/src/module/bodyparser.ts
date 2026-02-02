import { getParts } from 'uWebSockets.js';
import { parseQueryString } from '../utils.js';


export interface BodyParser<SchemaDefault extends any>{

	/**
	 * Translate body from its buffer raw form to a Body typed object
	 * @param raw
	 * @param contentType
	 * @param schema
	 */
	parse<Body extends any, BodySchema extends SchemaDefault>(raw? : Buffer<ArrayBufferLike>, contentType? : string, schema? : BodySchema) : Promise<Body> | Body;
}


export class DefaultBodyParser implements BodyParser<any>{
	parse<Body extends any>(raw?: Buffer<ArrayBufferLike>, contentType?: string){
		if(!contentType || !raw?.length)
			return {} as Body;

		if(contentType === 'application/json'){
			const bodyStr = raw.toString();
			return bodyStr ? JSON.parse(bodyStr) as Body : {} as Body;
		}

		if(contentType === 'application/x-www-form-urlencoded'){
			const bodyStr = raw.toString();
			return bodyStr ? parseQueryString(bodyStr) as Body : {} as Body;
		}

		if (contentType.startsWith('multipart/form-data')) {
			const multiparts = getParts(raw, contentType);
			if(!multiparts) 
				return {} as Body;
			
			const data: Record<string, string> = {};
			for(const p of multiparts){
				if (!p.type && !p.filename) 
					data[p.name] = Buffer.from(p.data).toString();
			}

			return data as Body;
		}

		return raw as Body;
	}
}
