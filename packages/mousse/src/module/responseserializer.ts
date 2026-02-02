export interface ResponseSerializer<SchemaDefault extends any>{

	/**
	 * Translate response object to sendable type string | Buffer | ArrayBuffer
	 * @param res
	 * @param schema
	 */
	serialize<Response extends any, ResponseSchema extends SchemaDefault>(res? : Response, schema? : ResponseSchema) : string | Buffer | ArrayBuffer;
}


export class DefaultResponseSerializer implements ResponseSerializer<any>{
	serialize<Response extends unknown>(res?: Response | undefined){
		return JSON.stringify(res ?? {});
	}
}