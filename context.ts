//@ts-ignore
import type { Response, ServerRequest} from "https://deno.land/std@0.78.0/http/server.ts"

export class Context<T = any>{

    req: ServerRequest;
    res: Response;
    params : Record<string, string>;
    processedUrl: string;
    data: T | undefined;

    constructor(req : ServerRequest){
        this.req = req;
        this.res = {};
        this.params = {};
        this.processedUrl = "";
    }

    respond(res?: Response) {
        if (res) {
            this.req.respond(res);
        }
        else {
            this.req.respond(this.req);
        }
    }

    //TODO : add helpers for response : cookies, contenttype, renderer ?
}