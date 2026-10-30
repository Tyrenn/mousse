import { Mousse, Router, HTTPError } from '@tyren/mousse';

const users = new Router()
	.use((c) => {
		if (!c.getHeader('authorization'))
			return c.status(401).respond();   // nothing else runs
	})
	.get('/:id', (c) => {
		if (c.param('id') === '0')
			throw new HTTPError(404, 'No such user');
		return { id: c.param('id') };         // sent as json
	});

new Mousse()
	.use('/users', users)
	.setDefaultHandler({ handle: (c) => c.status(404).respond('Nothing here') })
	.listen(3000);
