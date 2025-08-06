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
  return { status: 200, body: "Hello World !" };
}).start();
```

In this example `mousse` is the Mousse application. The method ```get(path, handler)``` is used to specify what to do when a GET request target the `"/"` path. In the arrow handler declaration, c is a `Context` instance and contains the request, the response and multiple utility methods.

## Handlers and Routers


### Basic routing

The primary objective of Mousse is to provide an routing tool to allow efficient and easy request handling based on request's path and method type.

When a request is recieved by a `Mousse` application, it is wrapped into a `Context` object before being routed through appropriate middlewares and handler depending on request method and url.
Each middleware is executed synchronously regardless of its type (async or sync).

To register middlewares and a handler in to a Mousse app you just need to use one of the multiple registration function on the form of :

```ts
mousse.METHOD(pattern, middleware1, middleware2, handler);
```

With `mousse` the Mousse application `METHOD` the corresponding request method (get, post, patch, ws, sse etc), `pattern` is the part of url the request url as to match in order to be sent through the middlewares `middleware1` and `middleware2` and end its journey in the `handler` which is a handler function that must take a Context as first argument.

Registering middlewares and handler on a new path opens a new possible "route" for requests to target. You can either create passive route with a simple plain path or use a dynamic path to get parameters.

```ts
mousse.get("/staticpath", (c) => { console.log("Static route");});

mousse.get("/dynamicpath/:myparam", (c) => { console.log("Dynamic " + c.params["myparam"] + " route"; )} );
```

### Handler and Middleware function

Handler and Middleware are function that takes a `Context` object as an argument. The only difference between both is the fact that Handler function may return a result which will be considered as the response body if the request has not been answered yet.

```ts
mousse.get("",
  (c) => {
    console.log("Middleware");
  },
  (c) => {
    console.log("Final handler");
	 return "Hello World !"; 
  }
 )
```

### Router object

In order to better structure your Mousse application, you can create a `Router` object that provides similar routing functions than Mousse application.

Once you have created your router and registered routes on it you can bind it to a specific path to your Mousse application.

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

Mousse provides a simple way to manage WebSockets.

```ts

mousse.ws("/websocket",
  (context) => {
		// This context is upgradable 
      //Upgradable requests hitting /websocket 
	}
);
```

> *** WIP ***

## Server-Sent Events

Mousse provides a simple way to manage Server-Sent Events (SSE) system. Each SSE are sustained ```GET``` requests.

```ts
mousse.get("/serversentevent/get",
  (context : Context) => {
    // This context is sustainable, meaning you can call .sustain() to start a sse channel. 
	 context.sustain();

	// Will send "hello" through a SSE
	 setTimeout(() => context.send("hello"), 500);
  }
);

mousse.sse("/serversentevent/sse",
  (context : Context) => {
      // This context has already been sustained 
		// Will send "hello" through a SSE
	 	setTimeout(() => context.send("hello"), 500);
	}
);
```

> NOTE : sustain() will through an error if context is not sustainable but will do nothing if it is already sustained.


## Contributing

> Disclaimer Even though i'm proud of this first version, it represents one of my first public, ambitious and typescript based module. Many improvements needs to be done and will be, I hope.

I haven't yet decided a clear procedure to contibute to this package. I guess the main contribution you can make for now is test it and open issues to help me chase the bugs. I will try to fix them as fast as I can while thinking of better implementation for performance gain and new handy features. If this package begins to get big attention, I might invite most interested people to participate in its design and development.

Note that further improvements regarding documentation are coming.