import { Context } from "./context";

export type ErrorHandler = (error: any, c? : Context<any>) => void | Promise<void>;

export type WebsocketEventErrorHandler = (error : any) => void | Promise<void>;