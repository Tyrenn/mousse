//@ts-ignore
import type { Context, ContextHandler } from "./context.ts"
//@ts-ignore
import { match, Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'

export class Route{
	path: string;
	slashes: number;
	handlersStack : Array<ContextHandler> = new Array<ContextHandler>();
	pathregexp : MatchFunction<Record<string,string>>;

	params: Record<string, string> = {};

	constructor(path : string, ...handlers : Array<ContextHandler>){
		this.path = path;
		if (this.path.length > 1) {
			this.path = this.path.replace(/\/$/, '');
		}
		
		this.slashes = this.path.split("/").length;

		this.pathregexp = match<Record<string, string>>(this.path, { decode: decodeURIComponent });
		this.handlersStack = handlers;
	}

	match(path : string) : Boolean{
    console.log("Remaining ", path, "  To match on ", this.path);

		path = ((path.split('/')).splice(0, this.slashes)).join("/");
    if (path != null) {
			let match: Match<Record<string,string>> = this.pathregexp(path);
			console.log("Matched : ", match);
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

	addHandler(handler: ContextHandler) {
		this.handlersStack.push(handler);
	}

	handle(context : Context){

    //Fixing param for handlers
		let urlpcd : string = context.urlpcd + this.path;
		let params : Record<string, string> = { ...context.params, ...this.params };
		let stack : Array<ContextHandler> = this.handlersStack;
		let idx : number = 0;
		let next = function (){
			if(idx < stack.length){
				//Request infos are reset before dispatching context to same level handlers
				context.urlpcd = urlpcd;
        context.params = params;

				stack[idx++].handle(context, next);
			}
		};

		/* Execute handlers in a middleware fashion way */
		next();
	}
}