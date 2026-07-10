import { StandardSchemaV1 } from '../schema.js';
import { HTTPRoute } from '../route.js';

export type JsonSchema = Record<string, any>;

/**
 * Translates a schema into JSON Schema for documentation generation.
 * Validation does not need this: it goes through Standard Schema directly.
 * One translator per schema library, registered under the vendor string the library
 * reports through Standard Schema (schema['~standard'].vendor : 'zod', 'arktype'...).
 */
export type DocSchemaTranslator = (schema : StandardSchemaV1) => JsonSchema;

/**
 * Ready-made translator for ArkType, whose types expose toJsonSchema() natively.
 * For other libraries, register their own translate function :
 * addDocSchemaTranslator('zod', z.toJSONSchema)
 */
export const arkTypeDocSchemaTranslator : DocSchemaTranslator = (schema) => (schema as any).toJsonSchema();

/**
 * Translate a schema using the translator registered for its vendor.
 * Returns undefined when no translator handles the schema vendor.
 */
export function translateSchema(schema : StandardSchemaV1, translators : Map<string, DocSchemaTranslator>) : JsonSchema | undefined {
	return translators.get(schema['~standard'].vendor)?.(schema);
}

/**
 * Vendors used by the routes schemas that have no registered translator.
 */
export function missingDocSchemaVendors(httproutes : HTTPRoute<any, any>[], translators : Map<string, DocSchemaTranslator>) : string[] {
	const missing = new Set<string>();

	for(const route of httproutes)
		for(const schema of Object.values(route.schemas ?? {})){
			const vendor = (schema as StandardSchemaV1)['~standard'].vendor;
			if(!translators.has(vendor))
				missing.add(vendor);
		}

	return [...missing];
}

/**
 * Throw when a route schema uses a vendor with no registered translator, listing
 * every missing vendor at once. Doc generators call this to fail fast instead of
 * silently documenting schemas as 'any'.
 */
export function assertDocSchemaTranslators(httproutes : HTTPRoute<any, any>[], translators : Map<string, DocSchemaTranslator>) : void {
	const missing = missingDocSchemaVendors(httproutes, translators);

	if(missing.length > 0)
		throw new Error(`No DocSchemaTranslator registered for vendor(s) ${missing.map(vendor => `'${vendor}'`).join(', ')}. `
			+ `Register one with addDocSchemaTranslator(vendor, translator) or through the 'translators' option, `
			+ `or set 'lenient : true' to document these schemas as 'any'.`);
}
