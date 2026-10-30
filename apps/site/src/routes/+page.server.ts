import { benchmarks, docEntries, highlight } from '#lib/server/content.ts';
import quickstart from '#lib/snippets/quickstart.ts?raw';
import http from '#lib/snippets/http.ts?raw';
import websockets from '#lib/snippets/websockets.ts?raw';
import sse from '#lib/snippets/sse.ts?raw';
import schemas from '#lib/snippets/schemas.ts?raw';
import ratelimit from '#lib/snippets/ratelimit.ts?raw';

export function load(){
	return {
		quickstart : highlight(quickstart.trim(), 'ts'),
		snippets : [
			{id : 'http', label : 'HTTP', doc : 'routing', summary : 'Routes, parameters, composable routers. Return a value or answer yourself.', html : highlight(http.trim(), 'ts')},
			{id : 'websockets', label : 'WebSockets', doc : 'websockets', summary : 'Upgrade through plain HTTP middlewares, then events and pub/sub on the open socket.', html : highlight(websockets.trim(), 'ts')},
			{id : 'sse', label : 'Server-Sent Events', doc : 'server-sent-events', summary : 'A sustained request with a backpressured send queue.', html : highlight(sse.trim(), 'ts')},
			{id : 'schemas', label : 'Schemas', doc : 'schemas', summary : 'Bring your Zod, ArkType or Valibot schemas : runtime validation and inferred types, no generics to write.', html : highlight(schemas.trim(), 'ts')},
			{id : 'ratelimit', label : 'Rate limiting', doc : 'rate-limiting', summary : 'Per route or per router, in memory or on Redis. Swappable like any module.', html : highlight(ratelimit.trim(), 'ts')}
		],
		benchmarks : benchmarks(),
		docs : docEntries()
	};
}
