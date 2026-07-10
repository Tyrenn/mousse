import { readdir } from 'node:fs/promises';

/**
 * Runs one example : pnpm start <name>
 * Every example exports its app (and optionally a port, or a run() taking over the launch).
 */
const name = process.argv[2];

if(!name){
	const files = await readdir(new URL('./src', import.meta.url));
	console.log('Usage : pnpm start <example>\n\nAvailable examples :');
	for(const file of files.filter((f) => f.endsWith('.ts')))
		console.log(`  - ${file.replace(/\.ts$/, '')}`);
	process.exit(1);
}

const example = await import(`./src/${name}.ts`).catch(() => {
	console.error(`Unknown example '${name}'. Run without argument to list them.`);
	process.exit(1);
});

if(example.run){
	await example.run();
}
else{
	const port = example.port ?? 3000;
	example.app.listen(port, (listenSocket : unknown, boundPort : number) => {
		console.log(listenSocket ? `[${name}] listening on http://localhost:${boundPort}` : `[${name}] failed to listen on port ${port}`);
	});
}
