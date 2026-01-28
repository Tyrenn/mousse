import Fastify from 'fastify'

const app = Fastify()

app.get('/hello', async (request, reply) => {
	return 'Hello from Fastify'
})

app.listen({ port: 3002, host : '127.0.0.1' }, (err, address) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}
	console.log(`Fastify listening on ${address}`)
})