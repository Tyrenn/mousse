import { createServer } from 'node:http'

// Raw node:http baseline : no routing, no framework
createServer((req, res) => {
	if (req.url === '/hello' && req.method === 'GET') {
		res.writeHead(200, { 'content-type': 'text/plain' })
		res.end('Hello from node:http')
	}
	else {
		res.writeHead(404)
		res.end()
	}
}).listen(3016, () => {
	console.log('node:http listening on http://localhost:3016')
})
