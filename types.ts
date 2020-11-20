//@ts-ignore
import { Context } from "./context.ts";
//@ts-ignore
import { WSContext } from './wscontext.ts';

/**
 * Types for http server
 */

export type RequestMethod = "CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";

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


/**
 * Types for Websocket server
 */

export interface WSHandler{
  handle(context: WSContext, next?: () => void): Promise<unknown> | unknown;
}

export interface WSHandlerFunction{
  (context: WSContext, next?: (() => void)): void;
}

export type WSHandlers = Array<WSHandler | WSHandlerFunction>;

export function isWSHandler(obj: any): obj is WSHandler {
  return typeof obj.handle != 'undefined'; 
}

export interface MoussOptions{
  port: number,
  hostname?: string | undefined,
  certFile?: string,
  keyFile?: string,
}

