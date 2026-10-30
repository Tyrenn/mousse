import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Router, Mousse, toOpenAPI } from '@tyren/mousse';
import { z } from 'zod';

const outputDir = await mkdtemp(join(tmpdir(), 'mousse-docgen-'));
after(() => rm(outputDir, {recursive : true, force : true}));

const zodTranslator = (schema : any) => z.toJSONSchema(schema);

function usersRouter(){
	return new Router()
		.get('/:id', {
			schemas : {
				Params : z.object({id : z.string()}),
				Response : z.object({id : z.string()})
			},
			doc : {summary : 'Get user', tags : ['Users']}
		}, (c) => ({id : c.param('id')}))
		.post('/', {
			schemas : {Body : z.object({name : z.string()}), Query : z.object({dryrun : z.string().optional()})}
		}, async (c) => await c.body());
}

describe('DocSchemaTranslator registry', () => {
	test('strict by default : missing vendor throws, listing it', async () => {
		await assert.rejects(
			usersRouter().generateOpenAPIDoc({outputDir}),
			(error : any) => error.message.includes(`'zod'`) && error.message.includes('DocSchemaTranslator')
		);
	});

	test('lenient documents unknown schemas as empty instead', async () => {
		await usersRouter().generateOpenAPIDoc({outputDir, fileName : 'lenient.json', lenient : true});
		const doc = JSON.parse(await readFile(join(outputDir, 'lenient.json'), 'utf8'));
		assert.ok(doc.paths['/{id}']);
	});

	test('registry merges by union on mount, target vendors kept', async () => {
		const users = usersRouter().addDocSchemaTranslator('zod', zodTranslator);

		const app = new Mousse();
		app.addDocSchemaTranslator('zod', () => ({type : 'string', 'x-from' : 'target'}));
		app.use('/users', users); // must NOT override the app's zod translator

		await app.generateOpenAPIDoc({outputDir, fileName : 'merged.json'});
		const doc = JSON.parse(await readFile(join(outputDir, 'merged.json'), 'utf8'));
		const schema = doc.paths['/users/{id}'].get.responses['200'].content['application/json'].schema;
		assert.equal(schema['x-from'], 'target');
	});

	test('per-call translators option wins over the registry', async () => {
		const router = usersRouter().addDocSchemaTranslator('zod', () => ({'x-from' : 'registry'}));

		await router.generateOpenAPIDoc({
			outputDir, fileName : 'override.json',
			translators : {zod : () => ({'x-from' : 'option'})}
		});
		const doc = JSON.parse(await readFile(join(outputDir, 'override.json'), 'utf8'));
		assert.equal(doc.paths['/{id}'].get.responses['200'].content['application/json'].schema['x-from'], 'option');
	});
});

describe('generateOpenAPIDoc', () => {
	test('produces a valid OpenAPI 3.1 structure from route schemas', async () => {
		const router = usersRouter().addDocSchemaTranslator('zod', zodTranslator);
		await router.generateOpenAPIDoc({outputDir, fileName : 'api.json', info : {title : 'Users API', version : '2.0.0'}});

		const doc = JSON.parse(await readFile(join(outputDir, 'api.json'), 'utf8'));
		assert.equal(doc.openapi, '3.1.0');
		assert.equal(doc.info.title, 'Users API');

		const get = doc.paths['/{id}'].get;
		assert.equal(get.summary, 'Get user');
		assert.deepEqual(get.tags, ['Users']);
		assert.equal(get.parameters[0].in, 'path');

		const post = doc.paths['/'].post;
		assert.equal(post.requestBody.required, true);
		assert.equal(post.parameters.find((p : any) => p.in === 'query').name, 'dryrun');
	});

	test('response schemas per status become OpenAPI responses', async () => {
		const router = new Router().get('/offers/:id', {
			schemas : {Response : {200 : z.object({id : z.string()}), 404 : z.object({error : z.string()}), '5xx' : z.object({error : z.string()})}}
		}, () => ({id : '1'})).addDocSchemaTranslator('zod', zodTranslator);
		await router.generateOpenAPIDoc({outputDir, fileName : 'statuses.json'});

		const responses = JSON.parse(await readFile(join(outputDir, 'statuses.json'), 'utf8')).paths['/offers/{id}'].get.responses;
		assert.deepEqual(Object.keys(responses).sort(), ['200', '404', '5XX']);
		assert.equal(responses['404'].description, 'Error');
		assert.equal(responses['404'].content['application/json'].schema.properties.error.type, 'string');
	});

	test('toOpenAPI stays usable as a pure function', () => {
		const doc = toOpenAPI([], {info : {title : 'Empty'}});
		assert.equal(doc.info.title, 'Empty');
		assert.deepEqual(doc.paths, {});
	});
});

describe('generateHTMLDoc', () => {
	test('importing mousse does not load highlight.js', () => {
		const output = execFileSync(process.execPath, ['--input-type=module', '-e',
			// Load hooks see ESM and CJS modules alike
			`import { registerHooks } from 'node:module';
			const loaded = [];
			registerHooks({load : (url, context, next) => { loaded.push(url); return next(url, context); }});
			await import('@tyren/mousse');
			console.log(loaded.some(url => url.includes('highlight.js')));`
		], {encoding : 'utf8'});
		assert.equal(output.trim(), 'false');
	});

	test('produces index, group pages and translated schema views', async () => {
		const app = new Mousse().use('/users', usersRouter());
		app.addDocSchemaTranslator('zod', zodTranslator);
		await app.generateHTMLDoc({outputDir : join(outputDir, 'html'), title : 'Test API'});

		const index = await readFile(join(outputDir, 'html', 'index.html'), 'utf8');
		assert.ok(index.includes('Test API'));

		const users = await readFile(join(outputDir, 'html', 'router', 'users.html'), 'utf8');
		assert.ok(users.includes('/users/:id'));
		assert.ok(users.includes('string'));

		// Untagged routes fall into the API group
		const api = await readFile(join(outputDir, 'html', 'router', 'api.html'), 'utf8');
		assert.ok(api.includes('/users'));
	});
});
