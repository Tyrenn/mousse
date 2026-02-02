import { Context } from "../context.js";

export interface HTTPErrorHandler{
	handle(error : any, c : Context<any>) : void | Promise<void>;
}

export interface WSErrorHandler{
	handle(error : any) : void | Promise<void>;
}
