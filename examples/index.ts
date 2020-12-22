//@ts-ignore
import { Mousse, Router, WSContext, HTTPContext, WebSocketTextEvent, WebSocketEvent } from "../mod.ts";


// Create Mousse App
let mousse = new Mousse({port : 8080});


// Set static route for ressources like css
mousse.static("/examples/res", ["svg"]);


// Create a new router
let kindRouter = new Router();

kindRouter.get("/:kind",
    function (context: HTTPContext) {
        context.respond({
            status: 200, body: " Path says : " + context.params.kind
        });
    }
);

kindRouter.get("/soap", (c) => {
  console.log("Special type !")
})

// Bind the router using use() method which will consider bubbleRouter as a middleware an let the context get through without any treatment
mousse.use("/kind", kindRouter);


// Create another router
let bubbleRouter = new Router();
bubbleRouter.get("", (c) => {
  c.respond({ status: 200, body: "I'm a Mousse bubble !" });
});

// Bind the router to /bubble routes using any() method which let only http context get through
mousse.any("/bubble", bubbleRouter);


// Using ws for an internal websocket handling
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


// Start the mousse app
mousse.start();