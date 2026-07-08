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

export type BenchmarkSummary = {
	name : string;
	requestsPerSec : number;
	latencyAvgMs : number;
	latencyP99Ms : number;
	throughputKBs : number;
	errors : number;
};

export function summarize(name : string, result : any) : BenchmarkSummary {
	return {
		name,
		requestsPerSec : result.requests.average,
		latencyAvgMs : result.latency.average,
		latencyP99Ms : result.latency.p99,
		throughputKBs : result.throughput.average / 1024,
		errors : result.errors
	};
}

export function formatComparisonTable(summaries : BenchmarkSummary[]) : string {
	const sorted = [...summaries].sort((a, b) => b.requestsPerSec - a.requestsPerSec);
	const nameWidth = Math.max(9, ...sorted.map(s => s.name.length));

	const pad = (str : string, width : number) => str.padEnd(width);
	const padNum = (str : string, width : number) => str.padStart(width);

	let table = `\n📊 Comparison (sorted by req/s)\n\n`;
	table += `${pad('Framework', nameWidth)}  ${padNum('req/s', 12)}  ${padNum('avg ms', 10)}  ${padNum('p99 ms', 10)}  ${padNum('KB/s', 12)}  errors\n`;
	table += `${'-'.repeat(nameWidth)}  ${'-'.repeat(12)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}  ${'-'.repeat(12)}  ------\n`;

	for(const s of sorted)
		table += `${pad(s.name, nameWidth)}  ${padNum(s.requestsPerSec.toFixed(0), 12)}  ${padNum(s.latencyAvgMs.toFixed(2), 10)}  ${padNum(s.latencyP99Ms.toFixed(2), 10)}  ${padNum(s.throughputKBs.toFixed(0), 12)}  ${s.errors}\n`;

	return table;
}