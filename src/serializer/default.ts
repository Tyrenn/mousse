import { getParts } from 'uWebSockets.js';
import { parseQuery } from '../utils';
import { Serializer } from './index';

export class DefaultSerializer implements Serializer<any>{
	serializeBody<Body extends any>(raw?: Buffer<ArrayBufferLike>, contentType?: string){
		if(!contentType || !raw?.length)
			return {} as Body;

		if(contentType === 'application/json'){
			const bodyStr = raw.toString();
			return bodyStr ? JSON.parse(bodyStr) as Body : {} as Body;
		}

		if(contentType === 'application/x-www-form-urlencoded'){
			const bodyStr = raw.toString();
			return bodyStr ? parseQuery(bodyStr) as Body : {} as Body;
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

	serializeResponse<Response extends unknown>(res?: Response | undefined){
		return JSON.stringify(res ?? {});
	}
}