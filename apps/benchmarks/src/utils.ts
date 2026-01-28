export function formatAutocannonResult(result: any): string {
	const {
		url,
		connections,
		pipelining,
		duration,
		start,
		finish,
		errors,
		timeouts,
		requests,
		latency,
		throughput,
	} = result;

	return `
📊 Benchmark Results

🌐 Target URL     : ${url}
⏱️ Duration       : ${duration}s
🔁 Connections    : ${connections}
📦 Pipelining     : ${pipelining}

🚀 Requests
  - Avg           : ${requests.average.toFixed(2)} req/s
  - Min           : ${requests.min}
  - Max           : ${requests.max}
  - Total         : ${requests.total}

📈 Latency
  - Avg           : ${latency.average.toFixed(2)} ms
  - Min           : ${latency.min} ms
  - Max           : ${latency.max} ms
  - P99           : ${latency.p99} ms

📶 Throughput
  - Avg           : ${(throughput.average / 1024).toFixed(2)} KB/s
  - Min           : ${(throughput.min / 1024).toFixed(2)} KB/s
  - Max           : ${(throughput.max / 1024).toFixed(2)} KB/s
  - Total         : ${(throughput.total / 1024 / 1024).toFixed(2)} MB

❌ Errors          : ${errors}
⏳ Timeouts        : ${timeouts}

🕒 Started at      : ${new Date(start).toLocaleTimeString()}
🕒 Finished at     : ${new Date(finish).toLocaleTimeString()}
`.trim();
}