//@ts-ignore
import { Handler } from "./types.ts"
//@ts-ignore
import { Context } from "./context.ts"
//@ts-ignore
import { match, Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'
export class Route{
    path : string;
    handlersStack : Array<Handler> = new Array<Handler>();
    pathregexp : MatchFunction<Record<string,string>>;

    params: Record<string, string> = {};

    constructor(path : string, ...handlers : Array<Handler>){
        this.path = path;
        if (this.path.length > 1)
            this.path = this.path.replace(/\/$/, '');
        
        this.pathregexp = match<Record<string, string>>(path, { decode: decodeURIComponent });
        this.handlersStack = handlers;
    }

    match(path : string) : Boolean{
        if (path != null) {
            let match: Match<Record<string,string>> = this.pathregexp(path);

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
        let processedUrl : string = context.processedUrl + this.path;
        let params : Record<string, string> = { ...context.params, ...this.params };
        let idx : number = 0;
        let stack : Array<Handler> = this.handlersStack;

        
        let next = function (){
            if(idx < stack.length){
                //Request infos are reset before every dispatching to same level middlewares
                context.processedUrl = processedUrl;
                context.params = params;

                stack[idx++].handle(context, next);
            }
        };

        /* Execute handlers in a middleware fashion way */
        next();
    }

}