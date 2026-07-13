import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema, validateSchemaSync, SchemaValidationError, type StandardSchemaV1 } from '@tyren/mousse';

// Minimal Standard Schema implementations, no library dependency
const stringSchema : StandardSchemaV1 = {
	'~standard' : {
		version : 1,
		vendor : 'test',
		validate : (value) => typeof value === 'string'
			? {value : value.trim()}
			: {issues : [{message : 'must be a string'}]}
	}
};

const asyncStringSchema : StandardSchemaV1 = {
	'~standard' : {
		version : 1,
		vendor : 'test',
		validate : async (value) => typeof value === 'string'
			? {value}
			: {issues : [{message : 'must be a string'}]}
	}
};

describe('validateSchema', () => {
	test('returns the schema output value', async () => {
		assert.equal(await validateSchema(stringSchema, 'body', '  hello  '), 'hello');
	});

	test('supports async validation', async () => {
		assert.equal(await validateSchema(asyncStringSchema, 'body', 'hello'), 'hello');
	});

	test('throws SchemaValidationError carrying part and issues', async () => {
		await assert.rejects(validateSchema(stringSchema, 'query', 42), (error : any) => {
			assert.ok(error instanceof SchemaValidationError);
			assert.equal(error.part, 'query');
			assert.equal(error.issues[0].message, 'must be a string');
			return true;
		});
	});
});

describe('validateSchemaSync', () => {
	test('validates synchronously', () => {
		assert.equal(validateSchemaSync(stringSchema, 'response', 'ok '), 'ok');
	});

	test('rejects schemas validating asynchronously', () => {
		assert.throws(() => validateSchemaSync(asyncStringSchema, 'response', 'ok'), TypeError);
	});

	test('throws SchemaValidationError on invalid value', () => {
		assert.throws(() => validateSchemaSync(stringSchema, 'response', 42), SchemaValidationError);
	});
});
