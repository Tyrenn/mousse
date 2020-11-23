//@ts-ignore
import { Handler, RequestMethod } from "./types.ts"
//@ts-ignore
import type { Context } from "./context.ts"
//@ts-ignore
import { match, Match, MatchFunction } from 'https://deno.land/x/path_to_regexp@v6.2.0/index.ts'

export class Route{
    path : string;
    method : RequestMethod;
    handlersStack : Array<Handler> = new Array<Handler>();
    pathregexp : MatchFunction<Record<string,string>>;
    pathnbslash : number;
    params : Record<string, string>;

    constructor(path : string, method : RequestMethod, ...handlers : Array<Handler>){
        this.path = path;
        //console.log("IN CONSTRUCTOR", path);
        this.pathregexp = match<Record<string, string>>(path, { decode: decodeURIComponent });
        this.pathnbslash = path.split("/").length - 1;

        this.method = method;

        this.handlersStack = handlers;
        //this.addHandlers(...handlers);

        this.params = {};
    }

    match(path : string) : Boolean{
        //Path is the complete request url
        //Matching only on equally "/" numbered path portion
        /*let splitpath = path.split("/");
        console.log("SPLITPATH ", splitpath);
        splitpath.splice(0,this.pathnbslash - 1);
        console.log("SPLITPATH", splitpath);

        path = splitpath.join("/");*/

        console.log("path in match :", path);

        if (path != null) {
            let match: Match<Record<string,string>> = this.pathregexp(path);
            
            console.log(match);

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

    //Route logic handle could go back in router ?

    handle(context : Context){
        /**
         * Check the pre-processed Url and save it to a fixed object sent to each child routes
        */
        let processedUrl : string = context.processedUrl + this.path;

        /**
        * Set context params
        */
        let params = this.params;

        /**
        * If true then no other route will process request.
        */
        //let isFinalRoute : Boolean = false;
        //if(context.req.url.length == processedUrl.length)
        //    isFinalRoute = true;

        /**
        * Freeze some context for next function aside processedUrl and Params
        */
        let idx : number = 0;
        let stack : Array<Handler> = this.handlersStack;

        
        let next = function (){
            if(idx < stack.length){
                //Request infos are reset before every dispatching to same level middlewares
                context.processedUrl = processedUrl;
                context.params = params;
                
                console.log(idx);

                stack[idx++].handle(context, next);
            }
        };

        /* Execute handlers in a middleware fashion way */
        next();
    }

}