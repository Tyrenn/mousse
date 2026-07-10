import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { translateSchema, missingDocSchemaVendors, assertDocSchemaTranslators, HTTPRoute, type StandardSchemaV1, type DocSchemaTranslator } from 'mousse';

const schemaOf = (vendor : string) : StandardSchemaV1 => ({
	'~standard' : {version : 1, vendor, validate : (value) => ({value})}
});

const translator : DocSchemaTranslator = () => ({type : 'string'});

const routeWith = (vendor : string) => new HTTPRoute({
	method : 'get', pattern : '/x', handler : () => {},
	schemas : {Response : schemaOf(vendor)}
});

describe('translateSchema', () => {
	test('dispatches on the schema vendor', () => {
		assert.deepEqual(translateSchema(schemaOf('zod'), new Map([['zod', translator]])), {type : 'string'});
	});

	test('returns undefined when no translator matches', () => {
		assert.equal(translateSchema(schemaOf('zod'), new Map()), undefined);
	});
});

describe('missingDocSchemaVendors', () => {
	test('collects unregistered vendors once', () => {
		const routes = [routeWith('zod'), routeWith('zod'), routeWith('arktype')];
		assert.deepEqual(missingDocSchemaVendors(routes, new Map([['arktype', translator]])), ['zod']);
	});

	test('empty when all vendors are covered or no schemas', () => {
		assert.deepEqual(missingDocSchemaVendors([routeWith('zod')], new Map([['zod', translator]])), []);
		assert.deepEqual(missingDocSchemaVendors([new HTTPRoute({method : 'get', pattern : '/x', handler : () => {}})], new Map()), []);
	});
});

describe('assertDocSchemaTranslators', () => {
	test('throws listing every missing vendor', () => {
		assert.throws(
			() => assertDocSchemaTranslators([routeWith('zod'), routeWith('valibot')], new Map()),
			(error : any) => error.message.includes(`'zod'`) && error.message.includes(`'valibot'`)
		);
	});

	test('passes when registry covers the routes', () => {
		assert.doesNotThrow(() => assertDocSchemaTranslators([routeWith('zod')], new Map([['zod', translator]])));
	});
});
