import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/hello', (c) => c.text('Hello from Hono'))

serve({ fetch: app.fetch, port: 3015 }, () => {
	console.log('Hono listening on http://localhost:3015')
})
