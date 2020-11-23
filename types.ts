//@ts-ignore
import { Context } from "./context.ts";

/**
 * Types for http server
 */

export type RequestMethod = "CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE" |"WS";

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

