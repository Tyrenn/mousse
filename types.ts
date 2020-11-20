//@ts-ignore
import { Context } from "./context.ts";

export interface Handler{
    handle (context : Context, next? : () => void) : Promise<unknown> | unknown;
}

export interface HandlerFunction{
  (context: Context, next?: (() => void)) : void;
}

export type Handlers = Array<Handler | HandlerFunction>;

export function isHandler(obj: any): obj is Handler {
    return typeof obj.handle != 'undefined'; 
  }

export type RequestMethod = "CONNECT" | "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT" | "TRACE";

export interface MousseOptions{
  port: number,
  hostname?: string | undefined,
  certFile?: string,
  keyFile?: string,
  https?: boolean
}

