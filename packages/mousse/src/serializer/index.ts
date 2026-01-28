export interface Serializer<SchemaDefault extends any>{

	/**
	 * Translate body from its buffer raw form to a Body typed object
	 * @param raw
	 * @param contentType
	 * @param schema
	 */
	serializeBody<Body extends any, BodySchema extends SchemaDefault>(raw? : Buffer<ArrayBufferLike>, contentType? : string, schema? : BodySchema) : Promise<Body> | Body;

	/**
	 * Translate response object to sendable type string | Buffer | ArrayBuffer
	 * @param res
	 * @param schema
	 */
	serializeResponse<Response extends any, ResponseSchema extends SchemaDefault>(res? : Response, schema? : ResponseSchema) : string | Buffer | ArrayBuffer;
}


/**
Might as well add "toDocumentation" method to be able to print schema
*/
