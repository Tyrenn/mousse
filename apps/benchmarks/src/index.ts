import { ChildProcess, spawn } from 'child_process'
import net from 'net'
import autocannon from 'autocannon'
import { formatAutocannonResult, formatComparisonTable, summarize, BenchmarkSummary } from './utils.js';

const servers = [
	{ name: 'uWebSockets.js', host: "localhost", port: 3010, file: './dist/uwebsocket.js' },
	{ name: 'mousse', host: "localhost", port: 3011, file: './dist/mousse.js' },
	{ name: 'express', host: "localhost", port: 3012, file: './dist/express.js' },
	{ name: 'fastify', host: "127.0.0.1", port: 3013, file: './dist/fastify.js' },
	{ name: 'hono', host: "127.0.0.1", port: 3015, file: './dist/hono.js' },
	{ name: 'node:http', host: "localhost", port: 3016, file: './dist/nodehttp.js' },
	{ name: 'koa', host: "localhost", port: 3017, file: './dist/koa.js' }
]

const waitForPort = (host : string, port : number, timeoutMs = 5000) : Promise<void> => new Promise((resolve, reject) => {
	const deadline = Date.now() + timeoutMs;

	const attempt = () => {
		const socket = net.connect({ host, port });

		socket.once('connect', () => { socket.destroy(); resolve(); });
		socket.once('error', () => {
			socket.destroy();
			if (Date.now() > deadline)
				reject(new Error(`Server did not start listening on ${host}:${port} within ${timeoutMs}ms`));
			else
				setTimeout(attempt, 50);
		});
	};

	attempt();
});

const runServer = async (file : string, host : string, port : number) : Promise<ChildProcess> => {
	const child = spawn('node', [file], {
		stdio: ['inherit', 'pipe', 'pipe']
	})

	child.stdout.on('data', (data) => {
		process.stdout.write(`[server stdout] ${data}`)
	})

	child.stderr.on('data', (data) => {
		process.stderr.write(`[server stderr] ${data}`)
	})

	await waitForPort(host, port);

	return child;
};

const runBenchmark = (url : string) => new Promise<any>((resolve, reject) => {
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

const summaries : BenchmarkSummary[] = [];

for (const server of servers) {
	console.log(`\n=== Benchmarking ${server.name} ===`)
	const proc = await runServer(server.file, server.host, server.port);
	try {
		const result = await runBenchmark(`http://${server.host}:${server.port}/hello`)
		console.log(formatAutocannonResult(result))
		summaries.push(summarize(server.name, result))
	} catch (err) {
		console.error(`Benchmark failed for ${server.name}:`, err)
	} finally {
		proc.kill()
		// Let the OS release the port before the next server binds it
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
}

if (summaries.length > 0)
	console.log(formatComparisonTable(summaries))
