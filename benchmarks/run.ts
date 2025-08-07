import { ChildProcess, spawn } from 'child_process'
import autocannon from 'autocannon'

const servers = [
	{ name: 'fastify', host : "127.0.0.1", port: 3002, file: './dist/benchmarks/fastify.js' },
	{ name: 'mousse', host: "127.0.0.1", port: 3000, file: './dist/benchmarks/mousse.js' },
	{ name: 'express', host: "localhost", port: 3001, file: './dist/benchmarks/express.js' },
	{ name: 'hyper-express', host: "localhost", port: 3003, file: './dist/benchmarks/hyper-express.js' },
]

const runServer : (path : string) => Promise<ChildProcess> = (file) => new Promise((resolve) => {
	const child = spawn('node', [file], {
		stdio: ['inherit', 'pipe', 'pipe']
	})

	child.stdout.on('data', (data) => {
		process.stdout.write(`[server stdout] ${data}`)
	})

	child.stderr.on('data', (data) => {
		process.stderr.write(`[server stderr] ${data}`)
	})
	
	setTimeout(() => resolve(child), 1000) // waiting for the server to start
});

const runBenchmark = (url : string) => new Promise((resolve, reject) => {
	autocannon({
		url,
		connections: 100,
		duration: 10
	},
	(err, results) => {
		if (err) return reject(err)
		resolve(results)
	})
})

for (const server of servers) {
	console.log(`\n=== Benchmarking ${server.name} ===`)
	const proc = await runServer(server.file);
	try {
		const result = await runBenchmark(`http://${server.host}:${server.port}/hello`)
		console.log(result)
	} catch (err) {
		console.error(`Benchmark failed for ${server.name}:`, err)
	} finally {
		proc.kill()
	}
}
