//@ts-ignore
import { Handler } from "./types.ts"
//@ts-ignore
import type { Context } from "./context.ts"
//@ts-ignore
import { match, Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'

export class Route{
	path: string;
	slashes: number;
	handlersStack : Array<Handler> = new Array<Handler>();
	pathregexp : MatchFunction<Record<string,string>>;

	params: Record<string, string> = {};

	constructor(path : string, ...handlers : Array<Handler>){
		this.path = path;
		if (this.path.length > 1) {
			//delete first slash
			this.path = this.path.replace(/^\//, '');
			//delete last slash
			this.path = this.path.replace(/\/$/, '');
		}
		
		this.slashes = this.path.split("/").length;

		this.pathregexp = match<Record<string, string>>(this.path, { decode: decodeURIComponent });
		this.handlersStack = handlers;
	}

	match(path : string) : Boolean{
	//! NEED TO MATCH ON A NUMBER OF SLASHES
		path = ((path.split('/')).splice(0, this.slashes)).join("/");
		if (path != null) {
			let match: Match<Record<string,string>> = this.pathregexp(path);
			console.log(path, " : ", match);
			if (typeof match != "boolean") {
				this.params = match.params;
				
				return true;
			}
			else {
				this.params = {};
				return false;
			}
		}
		else {
			return false;
		}
	}

	addHandler(handler: Handler) {
		this.handlersStack.push(handler);
	}

	handle(context : Context){
		/**
			* Check the pre-processed Url and save it to a fixed object sent to each child routes
		*/
		let urlpcd : string = context.urlpcd + "/" + this.path;
		let params : Record<string, string> = { ...context.params, ...this.params };
		let idx : number = 0;
		let stack : Array<Handler> = this.handlersStack;

		console.log(stack);

		let next = function (){
			if(idx < stack.length){
				//Request infos are reset before every dispatching to same level middlewares
				context.urlpcd = urlpcd;
				context.params = params;

				stack[idx++].handle(context, next);
			}
		};

		/* Execute handlers in a middleware fashion way */
		next();
	}

}