//@ts-ignore
import { isHandler, Handler, HandlerFunction, RequestMethod, WSHandler } from "./types.ts"
//@ts-ignore
import { WSContext } from "./wscontext.ts";
//@ts-ignore
import { match, Match, MatchFunction, MatchResult } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'

export class WSRoute{
    path : string;
    handlersStack : Array<WSHandler> = new Array<WSHandler>();
    pathregexp : MatchFunction<Record<string,string>>;
    pathnbslash : number;
    params : Record<string, string>;

    constructor(path : string, ...handlers : Array<WSHandler>){
        this.path = path;
        this.pathregexp = match<Record<string, string>>(path, { decode: decodeURIComponent });
        this.pathnbslash = path.split("/").length - 1;

        this.handlersStack = handlers;

        this.params = {};
    }

    match(path : string) : Boolean{
        //Path is the complete request url
      
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

    addHandler(handler: WSHandler) {
        this.handlersStack.push(handler);
    }

    handle(context : WSContext){
        /**
         * Check the pre-processed Url and save it to a fixed object sent to each child routes
        */
        let processedUrl : string = context.processedUrl + this.path;

        /**
        * Set context params
        */
        let params = this.params;
      
        /**
        * Freeze some context for next function aside processedUrl and Params
        */
        let idx : number = 0;
        let stack : Array<WSHandler> = this.handlersStack;

        
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