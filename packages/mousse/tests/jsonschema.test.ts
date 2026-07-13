import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { jsonSchemaToView, extractModels } from '@tyren/mousse';

describe('jsonSchemaToView', () => {
	test('primitives', () => {
		assert.equal(jsonSchemaToView({type : 'string'}), 'string');
		assert.equal(jsonSchemaToView({type : 'integer'}), 'number');
		assert.equal(jsonSchemaToView(undefined), 'any');
		assert.equal(jsonSchemaToView({}), 'any');
	});

	test('enums, consts and unions', () => {
		assert.equal(jsonSchemaToView({enum : ['a', 'b']}), '"a" | "b"');
		assert.equal(jsonSchemaToView({const : 42}), '42');
		assert.equal(jsonSchemaToView({anyOf : [{type : 'string'}, {type : 'null'}]}), 'string | null');
	});

	test('arrays and records', () => {
		assert.equal(jsonSchemaToView({type : 'array', items : {type : 'number'}}), 'Array<number>');
		assert.equal(jsonSchemaToView({type : 'object', additionalProperties : {type : 'string'}}), 'Record<string, string>');
	});

	test('objects mark optional properties', () => {
		const view = jsonSchemaToView({
			type : 'object',
			properties : {id : {type : 'number'}, name : {type : 'string'}},
			required : ['id']
		});
		assert.ok(view.includes('id : number'));
		assert.ok(view.includes('name? : string'));
	});

	test('$ref renders the model name', () => {
		assert.equal(jsonSchemaToView({$ref : '#/$defs/User'}), 'User');
	});
});

describe('extractModels', () => {
	test('collects named $defs', () => {
		const models = extractModels({
			type : 'object',
			properties : {user : {$ref : '#/$defs/User'}},
			$defs : {User : {type : 'object', properties : {id : {type : 'number'}}}}
		});
		assert.ok(models.some((model : any) => model.name === 'User'));
	});
});
