> **WARNING** : This is a work in progress as I rewrite all the code base, no package is yet available

# Mousse : Let us play with bubbles 

![tag](https://img.shields.io/badge/version-1.0.0-0082B4.svg)
![tag](https://img.shields.io/badge/licence-MIT-9cf.svg)

<img align="right" src=./examples/res/logo.svg height="150px">

Mousse is a NodeJS web server framework developed in typescript and based on [µWebSockets.js](https://github.com/uNetworking/uWebSockets.js). It provides simple ways to route http requests and handle websockets or server-sent events. It uses a middlewares-based structure and handlers as inspired by [hyper-expess](https://github.com/kartikk221/hyper-express), [mesh](https://github.com/ionited/mesh) and [expressJS](https://expressjs.com/).

> In french Mousse refers to soap foam, composed of thousands bubbles : the requests ☁️☁️ 

## Quick Start

```bash
npm install --save "mousse"
```

```ts
import { Mousse } from "mousse"

let mousse = new Mousse({port : 8080});

mousse.get("/", (c) => {
  c.response = { status: 200, body: "Hello World !" };
}).start();
```

In this example ```mousse``` is the Mousse application. The method ```get(path, handler)``` is used to specify what to do when a GET request target the ```"/"``` path. In the arrow handler declaration, c is of type ```HTTPContext``` and contains the request, the response and multiple utility methods.

## Handlers and Routers


### Basic routing

The primary objective of Mousse is to provide an efficient routing tool to allow efficient and easy request handling based on request's url and method type.

When a request is recieved by a ```Mousse``` application, it is wrapped into a ```Context``` object before being routed to handlers previously register depending on request method and url.
Each handler is executed synchronously regardless of whether async handlers or synchronous handlers.

To register handlers in to a Mousse app you just need to use one of the multiple registration function on the form of :

```ts
mousse.METHOD(path, myhandler);
```

With ```mousse``` the Mousse application ```METHOD``` the corresponding request method (get, post, patch, ws, sse etc), ```path``` is the part of url the request url as to match in order to be sent to ```myhandler``` which is a handler function that must take a Context as first argument.

Registering handlers on a new path opens a new possible "route" for requests to target. You can either create passive route with a simple plain path or use a dynamic path to get parameters.

```ts
mousse.get("/staticpath", (c) => { console.log("Static route");});

mousse.get("/dynamicpath/:myparam", (c) => { console.log("Dynamic " + c.params["myparam"] + " route"; )} );
```

### Handler function

A Handler must take a ```Context``` object like a ```HTTPContext``` as first argument and may take a second argument which will be a the next function.

> *** WIP ***


```ts
let globalbool : Boolean = false;

mousse.get("",
  (c, next)=>{
    console.log("First handler");
    if(globalbool)
      await next();
    globalbool = !globalbool
  },
  (c) => {
    console.log("Second handler"); 
    //The second handler will be getting the context once out of two.
  }
 )
```

> Note : using next without await breaks the synchronous handling as next function is an asynchronous function. Next without await will call next handlers asynchronously. Use it carefully.

### Router object

In order to better structure your Mousse application, you can create ```Router``` object that provides similar routing functions than Mousse application.

Once you have created your router and registered handlers on it you can bind it to a specific path to your Mousse application.

```ts
let mousse = new Mousse({port : 8080});

let myRouter = new Router();

myRouter.get("/", (c) => {
  c.response = { status: 200, body: "Hello World !" };
})

mousse.use("myRouterpath/", myRouter).start();;
```

## Context object

Before being routed and processed, each request to the server is converted into a Context object which type depends on the request type. Three different Context type exists : HTTPContext, WSContext and SSEContext. Each Context type proposes dedicated utility functions. All Context types also share common utility functions.

> *** WIP ***

## WebSockets

Mousse provide an simple way to manage WebSockets based on Deno Event system. Each websockets are upgraded ```GET``` requests, wrapped into a WSContext. 

The easiest way to create WebSockets routes and get WSContext is to use the Mousse built-in mechanism. Routers and Mousse objects implements a ```.ws(path, handlers)``` method that automatically convert upradable ```GET``` requests hitting ```path``` into WSContexts before passing it to handlers. As such, handlers that you can register using ```.ws()``` method take a WSContext as first argument. Like the rest of request http methods type, the ```.ws()``` handler registration method is a shortcut for ```.add("WS", path, handlers)``` method. Note that defining a route as a WebSocket route using ```.ws()``` method doesn't prevent you to define a classic get route with the same path.

```ts
mousse.get("/websocket",
  (context : HTTPContext) => {
    //All non upgradable GET requests will be sent through this handler 
  }
);

mousse.ws("/websocket",
  (context : WSContext) => {
      //Upgradable requests hitting /websocket path will be upgraded and wrapped into a WebSocket Context. 
	}
);
```

To be able to manage the all upgrade workflow, you can also create WebSockets routes using classic ```GET``` routes and the ```upgrade()``` method. This gives you more control. You can either declare the context as SSEContext and call ```upgrade()``` method on it or get the WSContext returned from ```upgrade()``` method called on a HTTPContext.

> *** WIP ***

## Server-Sent Events

Mousse provide an simple way to manage Server-Sent Events (SSE) system. Each SSE are sustained ```GET``` requests, wrapped into a SSEContext. 

The easiest way to create SSE routes and get SSEContext is to use the Mousse built-in mechanism. Routers and Mousse objects implements a ```.sse(path, handlers)``` method that automatically convert sustainable ```GET``` requests hitting ```path``` into SSEContexts before passing it to handlers. As such, handlers that you can register using ```.sse()``` method take a SSEContext as first argument. Like the rest of request http methods type, the ```.sse()``` handler registration method is a shortcut for ```.add("SSE", path, handlers)``` method. Note that defining a route as a SSE route using ```.sse()``` method doesn't prevent you to define a classic get route with the same path.

```ts
mousse.get("/serversentevent",
  (context : HTTPContext) => {
    //All non sustainable GET requests will be sent through this handler 
  }
);

mousse.ws("/serversentevent",
  (context : SSEContext) => {
      //Sustainable requests hitting /serversentevent path will be sustained and wrapped into a Server-Sent Event Context. 
	}
);
```

To be able to manage the all sustain workflow, you can also create SSE routes using classic ```GET``` routes and the ```sustain()``` method. This gives you more control. You can either declare the context as SSEContext and call ```sustain()``` method on it or get the SSEContext returned from ```sustain()``` method called on a HTTPContext.

```ts
mousse.get("/sseOtherWay1",
  (context : WSContext) => {
    if(context.sustainable)
      context.sustain(); //Sustain context request
    //context is SSEContext
  }
)

mousse.get("/sseOtherWay2",
  (context : HTTPContext) => {
    let ssecontext : SSEContext;
    if(context.sustainbale)
      ssecontext = context.sustain(); //Sustain context and get a ssecontext object from it
    //context is HTTPContext => do not use it anymore
    //ssecontext is SSEContext
  }
)
```

> NOTE : sustain() won't affect context if not sustainable.
> WARNING : please follow those 3 ways to create and manage Server-Sent Event route as unexepected behavior might occurs otherwise.

Once you have a SSEContext object you can register eventlistener on ```close``` event and also send messages to client.

```ts
mousse.sse("/websocket",
  (context : SSEContext) => {
    var interval = setInterval(() => { c.send(`data: ${new Date()}\n\n`) }, 1000);

    context.on("close", () => {
      console.log("Connection closed");
      clearInterval(interval);
    })
	}
);
```

## Rooms and stream

To be able to access client WebSockets and SSE from any handlers and process specific treatment, a Mousse application provides a room system. Each "stream" context type like WSContext and SSEContext can join and quit a room using ```.join(roomname : String)``` and ```.quit(roomname : String)```. By default, all WSContext and SSEContext join the unnamed room "". From any Context, you can call ```.in(roomname)``` method to get all stream type contexts registered in ```roomname```. The ```in``` method will return a ```StreamPool``` object containing one pool of WSContext (```streampool.websockets```) and one pool of SSEContext (```streampool.sses```). From those pools you can either broadcast or send a message to a particular WSContext or SSEContext based on its ID.

This feature inspired by the SocketIO room system is useful in many cases such as creating chatrooms. 

## Contributing

> Disclaimer Even though i'm proud of this first version, it represents one of my first public, ambitious and typescript based module. Many improvements needs to be done and will be, I hope.

I haven't yet decided a clear procedure to contibute to this package. I guess the main contribution you can make for now is test it and open issues to help me chase the bugs. I will try to fix them as fast as I can while thinking of better implementation for performance gain and new handy features. If this package begins to get big attention, I might invite most interested people to participate in its design and development.

Note that further improvements regarding documentation are coming.