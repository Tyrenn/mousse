//@ts-ignore
import { Context, HTTPContext, WSContext } from "./context.ts";

export type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" | "WS";

export type Identifier = { id: string }
/*
export interface Handler{
    handle (context : HTTPContext | WSContext, next? : () => void) : Promise<unknown> | unknown;
}*/

/*
export interface HTTPHandler{
  handle (context : HTTPContext, next? : () => void) : Promise<unknown> | unknown;
}

export interface WSHandler{
  handle (context : WSContext, next? : () => void) : Promise<unknown> | unknown;
}*/

export interface Handler{
  handle: HandlerFunction;
}

export type HandlerFunction = ((context: Context | WSContext | HTTPContext, next?: (() => void)) => Promise<void> | void);

export function isHandler(obj: any): obj is Handler {
	return typeof obj.handle != 'undefined'; 
}

export type Handlers = Array<Handler | HandlerFunction>;

export interface MoussOptions{
	port: number,
	hostname?: string,
	certFile?: string,
	keyFile?: string,
}

