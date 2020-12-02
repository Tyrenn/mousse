
//@ts-ignore
import { Mousse } from "./mousse.ts";
//@ts-ignore
import { Context, WSContext } from "./context.ts";
//@ts-ignore
import { Router } from "./router.ts";
//@ts-ignore
import { WebSocketTextEvent, isWebSocketConnectEvent, WebSocketEvent } from './websocket.ts';

let mousse = new Mousse({port : 8080});

let kindRouter = new Router();

kindRouter.get("/:kind",
    function (context: Context) {
        context.respond({
            status: 200, body: context.data + " Path says : " + context.params.kind
        });
    }
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

mousse.ws("/popping", async (c : WSContext) => {
    c.on("text", (event : WebSocketTextEvent) => {
      console.log("EVENT : ", event);
      console.log(event.data);
      //console.log("CONTEXT : ", c);
    });

	},
	async (c) => {
    console.log("ELLE S'EST CONNECTEEEE");

    c.on("text", (event: WebSocketTextEvent) => {
      console.log("LE SECOND : ", event.data);
      //console.log("CONTEXT : ", c);
    });
    c.on("close", (event) => {
      console.log("CLOSE");
    
    });
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
let a = m2 as A;
console.log(a.prop1);

*/