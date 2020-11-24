//@ts-ignore
import { Context } from "./context.ts";
//@ts-ignore
import { WebSocketPool } from './websocket.ts';

export type RequestMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";

export function isRequestMethod(obj: any): obj is RequestMethod{
	return (obj == ("DELETE" || "GET" || "HEAD" || "OPTIONS" || "PATCH" || "POST" || "PUT" || "TRACE"));
}

export type WebSocketMethod = "BINARY" | "CLOSE" | "PING" | "TEXT";

export function isWebSocketMethod(obj: any): obj is RequestMethod{
	return (obj == ("BINARY" || "CLOSE" || "PING" || "TEXT"));
}

export type Identifier = { id: string }

export type RouteInstances = {
	[key: string]: WebSocketPool;
}

export interface Handler{
    handle (context : Context, next? : () => void) : Promise<unknown> | unknown;
}

export function isHandler(obj: any): obj is Handler {
	return typeof obj.handle != 'undefined'; 
}

export interface HandlerFunction{
	(context: Context, next?: (() => void)) : void;
}

export type Handlers = Array<Handler | HandlerFunction>;

export interface MoussOptions{
	port: number,
	hostname?: string | undefined,
	certFile?: string,
	keyFile?: string,
}

