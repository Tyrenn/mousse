import Koa from 'koa'

const app = new Koa()

// Koa is middleware-only : minimal routing by hand, no @koa/router overhead
app.use((ctx) => {
	if (ctx.path === '/hello' && ctx.method === 'GET')
		ctx.body = 'Hello from Koa'
	else
		ctx.status = 404
})

app.listen(3017, () => {
	console.log('Koa listening on http://localhost:3017')
})
