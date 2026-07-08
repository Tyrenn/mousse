import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { HTTPRoute, WSRoute } from '../route.js';
import { DocGen } from '../module/docgen.js';
import { JsonSchema, SchemaParser, translateSchema } from '../module/schemaparser.js';

export type OpenAPIInfo = {
	title? : string;
	version? : string;
	description? : string;
};

export type OpenAPIOptions = {
	info? : OpenAPIInfo;
	schemaParsers? : SchemaParser[];
};

const METHODS : Record<string, string> = {
	get : 'get', post : 'post', put : 'put', patch : 'patch', del : 'delete', head : 'head', options : 'options'
};

/**
 * Assemble an OpenAPI 3.1 document from registered routes and their schemas.
 * 'any' routes are skipped : OpenAPI has no catch-all verb.
 */
export function toOpenAPI(httproutes : HTTPRoute<any, any>[], options? : OpenAPIOptions) : JsonSchema {
	const parsers = options?.schemaParsers ?? [];
	const paths : Record<string, any> = {};

	for(const route of httproutes){
		const method = METHODS[route.method];
		if(!method)
			continue;

		// uWS '/users/:id' -> OpenAPI '/users/{id}'
		const path = route.pattern.replaceAll(/:([\w]+)/g, '{$1}');
		const operation : Record<string, any> = {};

		if(route.doc?.summary)
			operation.summary = route.doc.summary;
		if(route.doc?.description)
			operation.description = route.doc.description;
		if(route.doc?.tags)
			operation.tags = route.doc.tags;

		operation.parameters = buildParameters(route, parsers);
		if(operation.parameters.length === 0)
			delete operation.parameters;

		if(route.schemas?.Body && ['post', 'put', 'patch', 'delete'].includes(method)){
			operation.requestBody = {
				required : true,
				content : {'application/json' : {schema : translateSchema(route.schemas.Body, parsers) ?? {}}}
			};
		}

		operation.responses = route.schemas?.Response
			? {200 : {description : 'Success', content : {'application/json' : {schema : translateSchema(route.schemas.Response, parsers) ?? {}}}}}
			: {200 : {description : 'Success'}};

		paths[path] = {...paths[path], [method] : operation};
	}

	return {
		openapi : '3.1.0',
		info : {
			title : options?.info?.title ?? 'Mousse API',
			version : options?.info?.version ?? '0.0.0',
			...(options?.info?.description ? {description : options.info.description} : {})
		},
		paths
	};
}

/**
 * DocGen writing the OpenAPI 3.1 document as a json file.
 * WebSocket routes are ignored : OpenAPI does not describe them.
 */
export class OpenAPIDocGen implements DocGen {

	private _options : OpenAPIOptions & {outputDir : string, fileName? : string};

	constructor(options : OpenAPIOptions & {outputDir : string, fileName? : string}){
		this._options = options;
	}

	async toDocumentation(httproutes : HTTPRoute<any, any>[], _wsroutes : WSRoute<any, any>[]) : Promise<void> {
		const document = toOpenAPI(httproutes, this._options);

		await mkdir(this._options.outputDir, {recursive : true});
		await writeFile(join(this._options.outputDir, this._options.fileName ?? 'openapi.json'), JSON.stringify(document, null, '\t'));
	}
}

function buildParameters(route : HTTPRoute<any, any>, parsers : SchemaParser[]) : any[] {
	const parameters : any[] = [];

	// Path parameters : schema properties when provided, plain strings otherwise
	const paramsSchema = route.schemas?.Params ? translateSchema(route.schemas.Params, parsers) : undefined;
	for(const name of route.pattern.match(/:[\w]+/g) ?? []){
		const key = name.slice(1);
		parameters.push({
			name : key,
			in : 'path',
			required : true,
			schema : paramsSchema?.properties?.[key] ?? {type : 'string'}
		});
	}

	// Query parameters : one per property of the Query object schema
	const querySchema = route.schemas?.Query ? translateSchema(route.schemas.Query, parsers) : undefined;
	if(querySchema?.properties){
		const required : string[] = querySchema.required ?? [];
		for(const [key, schema] of Object.entries(querySchema.properties)){
			parameters.push({name : key, in : 'query', required : required.includes(key), schema});
		}
	}

	return parameters;
}
