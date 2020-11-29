//@ts-ignore
import { Context, HTTPContext, WSContext } from "./context.ts";
//@ts-ignore
import { WebSocketCloseEvent, WebSocketPingEvent, WebSocketPongEvent } from 'https://deno.land/std@0.78.0/ws/mod.ts';
//@ts-ignore
import { hasOwnProperty } from "https://deno.land/std@0.78.0/_util/has_own_property.ts";

export type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" | "WS";

export type Identifier = { id: string }

export interface WebSocketConnectEvent {
	id: string;
}

export function isWebSocketConnectEvent(obj: WebSocketEvent): obj is WebSocketConnectEvent {
	return hasOwnProperty(obj, "id");
}

export type WebSocketEvent =
	|	string
	|	Uint8Array
	|	WebSocketCloseEvent 
	|	WebSocketPingEvent
	|	WebSocketPongEvent	
	|	WebSocketConnectEvent

export interface Handler{
	handle: HandlerFunction;
}

export type HandlerFunction = ((context: Context, next?: (() => void)) => Promise<void> | void);

export function isHandler(obj: any): obj is Handler {
	return typeof obj.handle != 'undefined'; 
}

export type Handlers = Array<Handler | HandlerFunction>;


export interface WSHandler{
	handle: WSHandlerFunction;
}

export type WSHandlerFunction = ((context: WSContext, next?: (() => void)) => Promise<void> | void);


export type WSHandlers = Array<WSHandler | WSHandlerFunction>

export interface HTTPHandler{
	handle: HTTPHandlerFunction;
}

export type HTTPHandlerFunction = ((context: HTTPContext, next?: (() => void)) => Promise<void> | void);


export type HTTPHandlers = Array<WSHandler | WSHandlerFunction>

export interface MousseOptions{
	port: number,
	hostname?: string,
	certFile?: string,
	keyFile?: string,
}