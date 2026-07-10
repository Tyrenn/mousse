import { Context } from "../context.js";

export interface HTTPErrorHandler{
	// The return is ignored : 'return c.status(422).json(...)' is the documented early-exit idiom
	handle(error : any, c : Context<any>) : void | Context<any> | Promise<void | Context<any>>;
}

export interface WSErrorHandler{
	handle(error : any) : void | Promise<void>;
}
