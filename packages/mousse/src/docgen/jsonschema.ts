import { JsonSchema } from './docSchemaTranslator.js';

/**
 * Render a JSON Schema as a typescript-looking code view for documentation pages.
 * $refs are rendered as their model name so the html renderer can link models.
 */
export function jsonSchemaToView(schema : JsonSchema | undefined, indent : number = 0) : string {
	if(!schema || Object.keys(schema).length === 0)
		return 'any';

	if(schema.$ref)
		return refName(schema.$ref);

	if(schema.const !== undefined)
		return JSON.stringify(schema.const);

	if(schema.enum)
		return schema.enum.map((value : any) => JSON.stringify(value)).join(' | ');

	if(schema.anyOf || schema.oneOf)
		return (schema.anyOf ?? schema.oneOf).map((sub : JsonSchema) => jsonSchemaToView(sub, indent)).join(' | ');

	if(schema.allOf)
		return schema.allOf.map((sub : JsonSchema) => jsonSchemaToView(sub, indent)).join(' & ');

	switch(schema.type){
		case 'string':
		case 'number':
		case 'boolean':
		case 'null':
			return schema.type;
		case 'integer':
			return 'number';
		case 'array':
			return `Array<${jsonSchemaToView(schema.items, indent)}>`;
		case 'object':
			return objectView(schema, indent);
	}

	return 'any';
}

function objectView(schema : JsonSchema, indent : number) : string {
	const properties = schema.properties ?? {};
	const required : string[] = schema.required ?? [];
	const keys = Object.keys(properties);

	if(keys.length === 0){
		if(schema.additionalProperties && typeof schema.additionalProperties === 'object')
			return `Record<string, ${jsonSchemaToView(schema.additionalProperties, indent)}>`;
		return 'object';
	}

	const tabs = '\t'.repeat(indent + 1);
	let view = '{\n';

	for(const key of keys){
		const optional = required.includes(key) ? '' : '?';
		view += `${tabs}${key}${optional} : ${jsonSchemaToView(properties[key], indent + 1)};\n`;
	}

	view += `${'\t'.repeat(indent)}}`;

	return view;
}

function refName(ref : string) : string {
	return ref.split('/').pop() ?? ref;
}

/**
 * Extract named definitions ($defs / definitions) of a JSON Schema as
 * documentation models : {name, view}.
 */
export function extractModels(schema : JsonSchema | undefined) : Array<{name : string, view : string}> {
	const defs : Record<string, JsonSchema> = {...schema?.$defs, ...schema?.definitions};

	return Object.entries(defs).map(([name, definition]) => ({
		name,
		view : `interface ${name} ${jsonSchemaToView(definition)}`
	}));
}
