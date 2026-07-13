import { Mousse, Router } from '@tyren/mousse';

export const port = 8080;

/**
 * Routers are mountable collections of routes : mounting copies them with the
 * pattern prefix, so a definition can be reused at several paths.
 */
const users = new Router({
	// Router defaults apply to every route it contains ; route options win over them
	logger : {log : (data) => console.log('[users]', data)}
})
	.get('/', (c) => {
		c.log('listing users');
		return [{id : 1}, {id : 2}];
	})
	.get('/:id', (c) => ({id : c.param('id')}));

const admin = new Router()
	.use((c) => {
		// Scoped middleware : runs for every route of this router
		if(!c.getHeader('authorization'))
			return c.status(401).respond('Who are you ?');
	})
	.del('/users/:id', (c) => ({deleted : c.param('id')}));

export const app = new Mousse()
	.use('/users', users)
	.use('/admin', admin)
	.setDefaultHandler({handle : (c) => c.status(404).respond('Nothing here')});
