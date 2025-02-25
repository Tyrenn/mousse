import type { Context, CommonContext, ContextHandler } from "./context.ts"
import { match, Match, MatchFunction } from './ext.ts'

export class Route{
	path: string;
	slashes: number;
	handlersStack : Array<ContextHandler<CommonContext>> = new Array<ContextHandler<CommonContext>>();
	pathregexp : MatchFunction<Record<string,string>>;

	params: Record<string, string> = {};

	constructor(path : string, ...handlers : Array<ContextHandler<CommonContext>>){
		this.path = path;
		if (this.path.length > 1) {
			this.path = this.path.replace(/\/$/, '');
		}
		
		this.slashes = this.path.split("/").length;

		this.pathregexp = match<Record<string, string>>(this.path, { decode: decodeURIComponent });
		this.handlersStack = handlers;
	}

	match(path : string) : Boolean{
    //console.log("Remaining ", path, "  To match on ", this.path);

		path = ((path.split('/')).splice(0, this.slashes)).join("/");
    if (path != null) {
			let match: Match<Record<string,string>> = this.pathregexp(path);
			//console.log("Matched : ", match);
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

  addHandler(handler: ContextHandler<CommonContext>, index?: number) {
    if (index) {
      this.handlersStack.splice(index, 0, handler);
    }
    else {
      this.handlersStack.push(handler);
    }
  }

	async handle(context : Context){

    let routecontext = {
		  urlpcd : context.urlpcd + this.path,
		  params : { ...context.params, ...this.params },
		  stack : this.handlersStack,
      idx : 0,
    }

		let next = async function (){
			if(routecontext.idx < routecontext.stack.length){
				//Request infos are reset before dispatching context to same level handlers
				context.urlpcd = routecontext.urlpcd;
        context.params = routecontext.params;

				await routecontext.stack[routecontext.idx++].handle(context, next);
			}
		};

		/* Execute handlers in a middleware fashion way */
		await next();
	}
}