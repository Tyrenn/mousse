import { Mousse } from '@tyren/mousse';
import { z } from 'zod';

new Mousse()
	.post('/orgs/:org/users', {
		schemas: {
			Body: z.object({ name: z.string(), email: z.email() }),
			Response: z.object({ id: z.number() })
		}
	}, async (c) => {
		const body = await c.body();   // { name: string; email: string }, validated and typed
		console.log(body.name);
		return { id: 1 };              // must match the Response schema
	})
	.listen(3000);
