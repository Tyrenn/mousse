//@ts-ignore
import { Mousse } from "./mousse.ts";
//@ts-ignore
import { Context, WSContext } from "./context.ts";
//@ts-ignore
import { Router } from "./router.ts";
//@ts-ignore
import { isWebSocketConnectEvent } from './websocket.ts';


let mousse = new Mousse({port : 8080});

let testEvent = new EventTarget();
testEvent.addEventListener("hello", () => {
  console.log("OUI JE CAPTE N'IMPORTE QUEL EVENT BONJOUR");
})


let kindRouter = new Router();

kindRouter.get("/:kind",
  (context: Context) => {
      context.keepalive();
      context.send(`data: ${new Date()}\n\n`);
      const interval = setInterval(() => { context.send(`data: ${new Date()}\n\n`) }, 1000);
        //context.data = "What kind of Bubbles ?";
    }/*,
    function (context: Context) {
        context.respond({
            status: 200, body: context.data + " Path says : " + context.params.kind
        });
    }*/
);

kindRouter.get("/soap", (c) => {
  console.log("Special type !")
})

mousse.any("/kind", kindRouter);

// ANOTHER ROUTER

let bubbleRouter = new Router();

bubbleRouter.get("", (c) => {
  c.respond({ status: 200, body: "I'm a Mousse bubble !" });
});

mousse.any("/bubble", bubbleRouter);

// HANDLING WEBSOCKET

mousse.ws("/popping",
  async (c: WSContext<string>) => {
    if (c.event && isWebSocketConnectEvent(c.event)) {
      c.data = "CONNECTION DE LA SOCKET";
    }
    else {
      c.data = "MESSAGE DE LA SOCKET";
    }
		
		c.in("").broadcast("POP");
	},
	async (c: Context<string>) => {
    c.send(c.data as string);
	}
);

mousse.start();

//Mettre tout dans un objet socket dans le context
//Mettre tout dans un objet response dans le context

//in et to reste dans le context de base : communiquer avec des sockets depuis des routes http classiques

/*
export class A implements MinA1, MinA2{
	prop1: string = "aaaa";
	prop2: string = "bbbb";
	
	ahaha() {
		this.prop2 = "dddd";
  }

  changeprop2() : MinA1{
    this.prop1 = "ehehehe";
    return this;
  }
}

interface MinA1{
	prop2: string;
  ahaha: () => void;
}

interface MinA2{
  changeprop2(): MinA1;
}

class B{
  aobject: A = new A();
  get getaobject(): MinA2{
    return this.aobject;
  }
}


let test = new B();
console.log(test);
let m2: MinA2 = test.getaobject;
console.log(m2);
m2.changeprop2();
console.log(m2);



interface context1{
  ok1: string;

  change(): context2;
}

interface context2{
  ok2: string;
}

class context implements context1, context2{
  ok1: string;
  ok2: string;

  constructor() {
    this.ok1 = "ok1";
    this.ok2 = "ok2";
  }

  change(): this{
    this.ok2 = "OK";

    return this;
  }
}

type fctx = (c: context) => void;

function handle(f : fctx) {
  f(new context());
}*/