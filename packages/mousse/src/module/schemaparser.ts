import { StandardSchemaV1 } from './schema.js';

export type JsonSchema = Record<string, any>;

/**
 * Translates a schema into JSON Schema for documentation generation.
 * Validation does not need this : it goes through Standard Schema directly.
 * One parser per schema library, matched by the schema's vendor string.
 */
export interface SchemaParser {

	// Matched against schema['~standard'].vendor ('zod', 'arktype', 'valibot'...)
	vendor : string;

	toJsonSchema(schema : StandardSchemaV1) : JsonSchema;
}


/**
 * ArkType exposes toJsonSchema() directly on its types : no dependency needed.
 */
export class ArkTypeSchemaParser implements SchemaParser {
	vendor = 'arktype';

	toJsonSchema(schema : StandardSchemaV1) : JsonSchema {
		return (schema as any).toJsonSchema();
	}
}

/**
 * Generic parser built from a translate function, keeping mousse dependency free.
 * For Zod : new CustomSchemaParser('zod', z.toJSONSchema)
 */
export class CustomSchemaParser implements SchemaParser {
	vendor : string;

	private _translate : (schema : StandardSchemaV1) => JsonSchema;

	constructor(vendor : string, translate : (schema : StandardSchemaV1) => JsonSchema){
		this.vendor = vendor;
		this._translate = translate;
	}

	toJsonSchema(schema : StandardSchemaV1) : JsonSchema {
		return this._translate(schema);
	}
}


/**
 * Translate a schema using the parser matching its vendor.
 * Returns undefined when no parser handles the schema vendor.
 */
export function translateSchema(schema : StandardSchemaV1, parsers : SchemaParser[]) : JsonSchema | undefined {
	const vendor = schema['~standard'].vendor;

	return parsers.find(parser => parser.vendor === vendor)?.toJsonSchema(schema);
}
