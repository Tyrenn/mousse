import { Mousse, SchemaValidationError } from 'mousse';
import { z } from 'zod';

export const port = 8080;

/**
 * Any Standard Schema library works as-is (Zod, ArkType, Valibot...) :
 * runtime validation + full typing inferred from the schemas, no generics to write.
 */
export const app = new Mousse();

app.post('/orgs/:org/users', {
	schemas : {
		Body : z.object({name : z.string().trim(), email : z.string().email()}),
		Query : z.object({dryrun : z.coerce.boolean().optional()}),
		Params : z.object({org : z.string()}),
		Response : z.object({id : z.number(), org : z.string(), name : z.string()})
	}
}, async (c) => {
	const body = await c.body();   // { name: string; email: string } — validated AND typed
	c.query.dryrun;                // boolean | undefined — coerced by the schema

	return {id : 1, org : c.param('org'), name : body.name}; // must match the Response schema
});

// Customize validation failures with an httpErrorHandler
app.post('/strict', {
	schemas : {Body : z.object({value : z.number()})},
	httpErrorHandler : {
		handle : (error, c) => {
			if(error instanceof SchemaValidationError)
				return c.status(422).json({part : error.part, issues : error.issues});

			c.status(500).respond();
		}
	}
}, async (c) => await c.body());
