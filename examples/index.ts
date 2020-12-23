//@ts-ignore
import { Mousse, Router, WSContext, SSEContext, HTTPContext, WebSocketTextEvent, WebSocketEvent } from "../mod.ts";


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
mousse.use("/kind", kindRouter);// Bind the router using use() method which will consider bubbleRouter as a middleware an let the context get through without any treatment


// Create another router
let bubbleRouter = new Router();
bubbleRouter.get("", async (c) => {
  await c.respond({ status: 200, body: "I'm a Mousse bubble !" });
}); // Handlers can be asynchronous
mousse.any("/bubble", bubbleRouter); // Bind the router to /bubble routes using any() method which let only http context get through


// Create a server sent event route
mousse.sse("/serversentevent", (c) => {
  c.send("Welcome on the server sent event route");
})


// Using ws for an internal websocket handling
mousse.ws("/popping",
  async (c: WSContext) => {
    c.on("text", (event : WebSocketTextEvent) => {
      console.log("It says :", event.data);
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


// Both server-sent events and websockets can be obtained through get route
mousse.get("/otherwsway", async (c: WSContext) => {
  await c.upgrade();
  c.on("text", (event: WebSocketTextEvent) => {
    console.log("I'm also an upgraded bubble who says : ", event.data);
  })
});

mousse.get("/othersseway", async (c: SSEContext) => {
  await c.sustain();
  c.send("Welcome on the other way to deal with server sent event");
});


// Start the mousse app
mousse.start();