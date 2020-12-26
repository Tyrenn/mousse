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
        context.response = {
            status: 200, body: " Path says : " + context.params.kind
        };
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
mousse.use("/bubble", bubbleRouter);


// Create a server sent event route
mousse.sse("/serversentevent", (c : SSEContext) => {
  var interval = setInterval(() => { c.send(`data: Bonjour nous sommes le ${new Date()}\n\n`) }, 1000);
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

mousse.get("otherwsway", async (c) => {

});

// Both server-sent events and websockets can be obtained through get route
mousse.get("/otherwsway", async (c: WSContext) => {
  await c.upgrade();
  c.on("text", (event: WebSocketTextEvent) => {
    console.log("I'm also an upgraded bubble who says : ", event.data);
  })
});

mousse.get("/othersseway", async (c: SSEContext, next) => {
  await c.sustain();
  c.send("Welcome on the other way to deal with server sent event");

  if(next)
    await next();
},
  (c: SSEContext) => {
    var interval = setInterval(() => { c.send(`data: ${new Date()}\n\n`) }, 1000);
  }
);


// Start the mousse app
mousse.start();