# Mousse : Let the Deno play with bubbles

[![tag](https://img.shields.io/badge/deno->=1.0.0-brightgreen.svg)](https://github.com/denoland/deno)
[![tag](https://img.shields.io/badge/std-0.79.0-brightgreen.svg)](https://github.com/denoland/deno)
![tag](https://img.shields.io/badge/licence-MIT-9cf.svg)

Mousse is a Deno web server framework developed in typescrit. It provides simple way to route requests and handle websockets or server-sent event. Inspired by widespread framework like expressJS, it uses a similar structure based on middleware and handlers. This Deno framework was largely inspired by [abc](), [oak]() and [expressJS]().

> In french Mousse refers to Moss, composed of thousands of requests bubbles ☁️☁️ 

## Quick Start

```ts
import { Mousse } from "https://github.com/Tyrenn/mousse/mod.ts"

let mousse = new Mousse({port : 8080});

mousse.get("/", (c) => {
  c.respond({ status: 200, body: "Hello World !" });
}).start();
```

In this example ```mousse``` is the server app, a ```Mousse``` type object. The method ```get(path, handler)``` is used to specify what to do when a GET request target the ```"/"``` path. In the arrow handler declaration, c is of type ```HTTPContext``` and contains the request, the response and multiple method such as the ```respond(response?)``` to send back a response.

## Router and Routes

The primary objective of Mousse is the development of HTTP API with routes, router and handlers. Like in various web server framework, Mousse allows you to handle the request, as a HTTPContext, in multiple ways based on request path endpoint and request method type.

Each path endpoint can have multiple


