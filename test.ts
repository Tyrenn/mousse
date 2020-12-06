//@ts-ignore
import { Mousse, Router, WSContext, HTTPContext, WebSocketTextEvent, WebSocketEvent } from "./mod.ts";

let mousse = new Mousse({port : 8080});

let kindRouter = new Router();

kindRouter.get("/:kind",
    function (context: HTTPContext) {
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
      console.log("It says :", event.data);
      //console.log("CONTEXT : ", c);
    });

	},
  async (c) => {
    console.log("I'm connected !")

    c.on("text", (event: WebSocketTextEvent) => {
      console.log("Yeah indeed it says : ", event.data);
    });

    c.on("close", (event) => {
      console.log("It is now closed !")
    });
	}
);

mousse.start();