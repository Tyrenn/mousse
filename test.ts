
//class Route{};
/*
interface HandlerFunction{
    (req : string, res : string, next? : HandlerFunction) : void;
}

class RouterProto{
    wsRoutes: Route;
    name: string;

    constructor(n : string){
        this.wsRoutes = new Route();
        this.name = n;
    }

    handle(req : string, res : string, next? : HandlerFunction){
        console.log("oook");
    };

    ws(handler : HandlerFunction) : RouterProto {
        return this;
    };


}

function create(n : string) : Router{
    const instance = new RouterProto(n);
    return Object.assign(() => instance.handle(), {
    });
}

function Router(n : string) : HandlerFunction{
    const proto = new RouterProto(n);
    return Object.assign((req : string, res : string, next?: HandlerFunction) => proto.handle(req, res, next), {
        //ws: (handler: HandlerFunction) => proto.ws(handler)
    });
}

let test = Router("test");

console.log(test);
test("req", "res");

console.log(typeof(test));

let tey : HandlerFunction = (req : string, res : string, next?: HandlerFunction) => {};


console.log(typeof(tey));


interface Handler{
    handle (req : string, res : string, next? : Handler) : Promise<unknown> | unknown;
}

class Router implements Handler{
    routes : Record<"GET" | "POST" | "PUT" | "WS", Array<Handler>> = {
        GET : new Array<Handler>(),
        POST : new Array<Handler>(),
        PUT : new Array<Handler>(),
        WS : new Array<Handler>()
    }

    handle = (req : string, res : string, next? : Handler) => {
        console.log("ok");
    }
}

let test : Handler = new Router();

let other : Handler = {
    handle(req : string, res : string, next? : Handler){

    }
}

console.log(test instanceof Router);
console.log(other instanceof Router);



interface Handler{
    handle(context : string, next? : Function) : void;
}


let test : Handler = { handle(context: string, next : ()=> {}){ }};
let test2 : Handler = { handle(context: string){ }};

console.log(test.handle.length);
console.log(test2.handle.length);


let test3 : number[] = [1,2,3,4,1];
console.log(test3.findIndex((value) => value == 4));


let test = new Mouss({port : 8080});

test.add("/bonjour/:test", "GET",
    (context: Context) => {
        context.data = { ok: "First !!" };
    },
    function (context: Context) {
        let ok = context.data.ok;
        context.respond({
            status: 200, body: ok + "Bonjour" + context.params.test
        });
    }
);

test.ws("/boom", async (c: Context) => {
    if (c.websocket) {
        for await (const ev of c.websocket) {
            console.log(ev);
            c.websocket.send(ev as WebSocketMessage);
        }
    }
},
async (c: Context) => {
    if (c.websocket) {
        for await (const ev of c.websocket) {
            console.log(ev);
            c.websocket.send("SECOND");
        }
    }
});

test.start();*/

export type Thing = { name: string };
type Animal = { breed: string };
const thing: Thing = {
  name: "james"
};
const animal: Animal = {
  breed: "cat"
};
const cat: Thing & Animal = {
  ...thing,
  ...animal
};

console.log(cat);