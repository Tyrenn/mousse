//export { serve, serveTLS } from "https://deno.land/std@0.78.0/http/server.ts";
export { v4 } from "https://deno.land/std@0.78.0/uuid/mod.ts";

export { join } from "https://deno.land/std@0.80.0/path/mod.ts";

export { encode } from "https://deno.land/std@0.78.0/encoding/utf8.ts";

export { mime } from "https://github.com/Tyrenn/mimetypes/raw/main/mod.ts";

export { serve, serveTLS, Status, ServerRequest } from "https://deno.land/std@0.78.0/http/mod.ts";

export type { Response, HTTPOptions, HTTPSOptions, Server } from "https://deno.land/std@0.78.0/http/mod.ts";

export { match } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts';

export type { Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts';

export { acceptable, acceptWebSocket, isWebSocketCloseEvent, isWebSocketPingEvent, isWebSocketPongEvent } from 'https://deno.land/std@0.78.0/ws/mod.ts';

export type { WebSocket, WebSocketMessage } from 'https://deno.land/std@0.78.0/ws/mod.ts';

import { extname as extensionname } from "https://deno.land/std@0.80.0/path/mod.ts";

export function extname(path: string): string {
  return extensionname(path).split(".")[1];
}