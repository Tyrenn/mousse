# Mousse : Let the Deno play with bubbles 

![tag](https://img.shields.io/badge/version-1.0.0-0082B4.svg)
[![tag](https://img.shields.io/badge/deno->=1.0.0-brightgreen.svg)](https://github.com/denoland/deno)
[![tag](https://img.shields.io/badge/std-0.79.0-brightgreen.svg)](https://github.com/denoland/deno)
![tag](https://img.shields.io/badge/licence-MIT-9cf.svg)

<img align="right" src=./examples/res/logo.svg height="150px">

Mousse is a Deno web server framework developed in typescrit. It provides simple way to route requests and handle websockets or server-sent event. Inspired by widespread framework like expressJS, it uses a similar structure based on middleware and handlers. This Deno framework was largely inspired by [abc](), [oak]() and [expressJS]().

> In french Mousse refers to soap foam, composed of thousands of requests bubbles ☁️☁️ 

## Quick Start

```ts
import { Mousse } from "https://github.com/Tyrenn/mousse/raw/main/mod.ts"

let mousse = new Mousse({port : 8080});

mousse.get("/", (c) => {
  c.respond({ status: 200, body: "Hello World !" });
}).start();
```

In this example ```mousse``` is the Mousse application. The method ```get(path, handler)``` is used to specify what to do when a GET request target the ```"/"``` path. In the arrow handler declaration, c is of type ```HTTPContext``` and contains the request, the response and multiple method such as the ```respond(response?)``` to send back a response.

## Handlers and Router


### Basic routing

The primary objective of Mousse is to provide an efficient routing tool to allow efficient and easy request handling based on request's url and method type.

When a request is recieved to a ```Mousse``` application, it is wrapped in an ```HTTPContext``` object and sent to handlers previously register to handle specific request url and method type.

To register handlers in to a Mousse app you just need to use the following function

```ts
mousse.METHOD(path, yourhandler);
```

With ```mousse``` the Mousse application ```METHOD``` the corresponding HTTP request method (get, post, patch etc), ```path``` is the part of url the request url as to match in order to be sent to ```yourhandler``` which is a handler function that must take a HTTPContext as first argument.


### Handler function

A Handler must take a ```Context``` object like a ```HTTPContext``` as first argument and may take a second argument which will be a the next function.

The next function is useful in case you want to control the context flow. By default, the context will pass through each handler one after another. You can change this default behavior by introducing a second argument in your handler. If a handler contains a second argument, the context will get through the following handler only if this second argument is called. This mecanism can be useful in case of asynchronous handlers.

```ts
let globalbool : Boolean = false;

mousse.get("",
  (c, next)=>{
    console.log("First handler");
    if(globalbool)
      next();
    globalbool = !globalbool
  },
  (c) => {
    console.log("Second handler");
  }
 )
```

The second handler will be getting the context once out of two.

### Router object

In order to better structure your Mousse application, you can create ```Router``` object that provides similar routing functions than Mousse application.

Once you have created your router and registered handlers on it you can bind it to a specific path to your Mousse application.

```ts
let mousse = new Mousse({port : 8080});

let myRouter = new Router();

myRouter.get("/", (c) => {
  c.respond({ status: 200, body: "Hello World !" });
})

mousse.use("myRouterpath/", myRouter).start();;
```

## Context objects

