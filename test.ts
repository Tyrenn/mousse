
//class Route{};
//@ts-ignore
//import { Mousse } from "./mousse.ts";
//@ts-ignore
//import { Context, WSContext } from "./context.ts";
//@ts-ignore
//import { Router } from "./router.ts";

/*
let mousse = new Mousse({port : 8080});



let kindRouter = new Router();

kindRouter.get("/:kind",
    (context: Context) => {
        context.data = "What kind of Bubbles ?";
    },
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

mousse.ws("/popping",
	async (c: WSContext<string>) => {
		c.data = "BONJOUR";
		c.to("").broadcast("POP");
	},
	async (c: Context<string>) => {
		console.log(c.data);
	}
);

mousse.start();*/

//Mettre tout dans un objet socket dans le context
//Mettre tout dans un objet response dans le context

//in et to reste dans le context de base : communiquer avec des sockets depuis des routes http classiques

/*
class A{
	test: string = "aaaa";
	test2: string = "bbbb";
	
	ahaha() {
		this.test2 = "dddd";
	}
}

interface MinA{
	test: string;
	ahaha: () => void;
}

class B{
  aobject: A = new A();
  get getaobject(): MinA{
    return this.aobject;
  }
}


let test = new B();
console.log(test);
test.getaobject.test = "ccccc";
console.log(test);
test.getaobject.ahaha();
console.log(test);
*/





export interface context1{
  un: string;
}

interface context2{
  deux: string;
}

type Type1 = ((context: context1) => void);

type Type2 = ((context: context2) => void);


type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

function isContext1(obj: any): obj is context1{
  return obj.un != undefined;
}

function isType1(obj: Type1 | Type2): obj is Type1{
  //???
  let test : ArgumentTypes<typeof obj>[0];
  console.table(obj["arguments"]);
  return false;
}



let test: Type1 = async function f(c: context1) { };
isType1(test)
//isTest(test);