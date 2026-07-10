import { Mousse } from 'mousse';
import { z } from 'zod';

export const port = 8080;

/**
 * Route schemas + doc metadata feed the documentation generators.
 * Register one DocSchemaTranslator per schema vendor : generation is strict by
 * default and throws if a vendor used by the routes has no translator.
 *
 * Running this example generates ./docs-output then serves it statically.
 */
export const app = new Mousse();

app.addDocSchemaTranslator('zod', (schema) => z.toJSONSchema(schema as any));

app.get('/users/:id', {
	schemas : {
		Params : z.object({id : z.string()}),
		Response : z.object({id : z.string(), name : z.string()})
	},
	doc : {summary : 'Get a user', description : 'Returns a single user by id.', tags : ['Users']}
}, (c) => ({id : c.param('id'), name : 'Guillaume'}));

app.post('/users', {
	schemas : {
		Body : z.object({name : z.string(), email : z.string().email()}),
		Response : z.object({id : z.string()})
	},
	doc : {summary : 'Create a user', tags : ['Users']}
}, async (c) => ({id : '1'}));

export async function run(){
	const outputDir = './docs-output';

	await app.generateHTMLDoc({outputDir, title : 'Example API'});
	await app.generateOpenAPIDoc({outputDir, info : {title : 'Example API', version : '1.0.0'}});
	console.log(`Documentation generated in ${outputDir}`);

	app.get('/*', (c) => c.file(`${outputDir}${c.url === '/' ? '/index.html' : c.url}`));
	app.listen(port, (ls, p) => console.log(ls ? `Browse it on http://localhost:${p}` : 'Failed to listen'));
}
