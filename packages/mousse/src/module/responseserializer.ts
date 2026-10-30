export interface ResponseSerializer<SchemaDefault extends any>{

	/**
	 * Translate response object to sendable type string | Buffer | ArrayBuffer
	 * @param res
	 * @param schema
	 */
	serialize<Response extends any, ResponseSchema extends SchemaDefault>(res? : Response, schema? : ResponseSchema) : string | Buffer | ArrayBuffer;

	/**
	 * Optional : build a dedicated serializer for a response schema, once per schema at route registration.
	 * When present, it replaces serialize() for responses matching that schema (fast-json-stringify style).
	 * @param schema
	 */
	compile?<ResponseSchema extends SchemaDefault>(schema : ResponseSchema) : (res : any) => string | Buffer | ArrayBuffer;
}


export class DefaultResponseSerializer implements ResponseSerializer<any>{
	serialize<Response extends unknown>(res?: Response | undefined){
		return JSON.stringify(res ?? {});
	}
}