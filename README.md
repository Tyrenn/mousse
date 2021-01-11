# Mousse : Let the Deno play with bubbles 

![tag](https://img.shields.io/badge/version-1.0.0-0082B4.svg)
[![tag](https://img.shields.io/badge/deno->=1.0.0-brightgreen.svg)](https://github.com/denoland/deno)
[![tag](https://img.shields.io/badge/std-0.79.0-brightgreen.svg)](https://github.com/denoland/deno)
![tag](https://img.shields.io/badge/licence-MIT-9cf.svg)

<img align="right" src=./examples/res/logo.svg height="150px">

Mousse is a Deno web server framework developed in typescript. It provides simple ways to route http requests and handle websockets or server-sent events. Inspired by widespread framework like expressJS, it uses a similar structure based on middlewares and handlers. This Deno framework was largely inspired by [abc](https://deno.land/x/abc@v1.2.0), [oak](https://oakserver.github.io/oak/) and [expressJS](https://expressjs.com/).

> In french Mousse refers to soap foam, composed of thousands of requests bubbles ☁️☁️ 

## Quick Start

```ts
import { Mousse } from "https://github.com/Tyrenn/mousse/raw/main/mod.ts"

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

The next function is useful in case you want to control the context flow. By default, the context will pass through each handler one after another. You can change this default behavior by introducing a second argument in your handler. If a handler contains a second argument, the context will get through the following handler only if this second argument is called.

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

```
mousse;                         // Get mousse app that as created the context                    
id;                             // Get context ID
request;                        // The request recieved by the mousse app
method;                         // The context method which might differs from request method if context is sustained or upgraded
params;                         // URI parameters /:param1/:param2
url;                            // The requested URL
data;                           // Data field to store any kind of object
cookies;                        // Get cookies
upgradable;                     // Boolean to know if context is upgradable (i.e. converted into WSContext)
sustainable;                    // Boolean to know if context is sustainable (i.e. converted into SSEContext)
answered                        // Boolean to know if context has been answered : response has been sent or context were upgraded/sustained

upgrade();                      // Upgrade Context to WSContext if possible
sustain();                      // Sustain Context to SSEContext if possible
dispatchEvent(event);           // Send event to the Context's event target
in(roomname?);                   // Get All Websockets and SSE Targets present in roomname
on(type, listener, options?);    // Add an event listener to the Context's event target
off(type, listener, options?);   // Remove an event listener to the Context's event target
setCookie(cookie);              // Utility method to set cookie
```

In order to pass data between handlers in the same route, each Context object are template objects ```Context<typeof data>``` where data can be any type and accessed through the ```context.data``` property.
When working in typescript, you can specify data type by using template on the registration methods : ```add```, ```get```, ```post```, ```ws``` etc.

Here is an example where template are used on HTTPContext to pass a typed as string data.

```ts
mousse.get<HTTPContext<string>>("/", 
  (context : HTTPContext<string>) => {
    context.data = "Hello Mousse !";
  },
  (c) => {
    console.log(c.data);
  });

```

### HTTPContext<>

HTTPContext represents the majority of requests flow. Whenever a request isn't upgraded as a Websocket or sustained as a Server Sent Event, it gets through routers as an HTTPContext. Working with an HTTPContext allow the use of additionnal utility functions.

```js
  response?;                          // Accessor to the response object

  respond(res?);                      // Send the response
  string(data, code?);                // Set a string data as response
  json(data, code?);                  // Set a json data as response
  html(data, code?);                  // Set a html data as response
  blob(data, contentType?, code?);    // Set a blob of data as response
  file(filepath);                     // Set a file as response
  renderFile(filepath);               // Read and render a file content as response using the app renderer
  render(extensionType, data);        // Render data of type "extensionType" as response using the app renderer
  redirect(url, code?);               // Redirect the context
```

> WARNING : By default, if not answered, the app call the function respond at the end of handler process. Do not call this function prematuraly unless needed as its slows down request process for an obscure reason.

### WSContext<>

WSContext are WebSocket Context type, meaning upgraded "GET" HTTPContext. As such, a WSContext is no longer providing HTTPContext methods but rather proper WebSocket utility methods.

```
websocket?;                           // The websocket if it exists

join(roomname);                       // Add WSContext to roomname
quit(roomname);                       // Remove WSContext from roomname
send(data);                           // Send string or Uint8Array data to WebSocket
ping(data);                           // Ping WebSocket
close(closeEvent);                    // Close WebSocket
```

It exists 2 ways to obtain a WSContext; register a handler using Router or Mousse object ```.ws(path, ...handlers)``` method or "manually" call ```.upgrade()``` on an HTTPContext inside a ```GET``` handler. See section "WebSockets" for further details.

### SSEContext<>

SSEContext are Server-Sent Event Context type, meaning sustained "GET" HTTPContext. As such, a SSEContext is no longer providing HTTPContext methods but rather proper Server-Sent Event utility methods.

```
join(roomname);       // Add SSEContext to roomname
quit(roomname);       // Remove SSEContext from roomname
send(data);           // Send string or Uint8Array or ServerSentEvent data to client
close(closeEvent);    // Close connection
```

As for WSContext, it exists 2 way to obtain a SSEContext; register a handler using Router or mousse object ```.sse(path, ...handlers)``` method or "manually" call ```.sustain()``` on an HTTPContext inside a ```GET``` handler. See section "Server-Sent Events" for further details.


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

```ts
mousse.get("/websocketOtherWay1",
  (context : WSContext) => {
    if(context.upgradable)
      context.upgrade(); //Upgrade context request
  }
)

mousse.get("/websocketOtherWay2",
  (context : HTTPContext) => {
    let wscontext : WSContext;
    if(context.upgradable)
      wscontext = context.upgrade(); //Upgrade context and get a wscontext object from it
    //context is HTTPContext => do not use it anymore
    //wscontext is WSContext
  }
)
```

> NOTE : upgrade() won't affect context if not upgradable.
> WARNING : please follow those 3 ways to create and manage WebSockets route as unexepected behavior might occurs otherwise.

Once you have a WSContext object you can register eventlistener on classic WebSockets event i.e. : ```text```, ```binary```, ```ping``` and ```close``` and also send messages to client.

```ts
mousse.ws("/websocket",
  (context : WSContext) => {
     context.on("text", (data) => {
        console.log(data);
        context.send(new Date() + " : " + data) // send the date and data to client
     });
     context.on("close", () => {
      console.log("Connection closed");
     })
	}
);
```

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

I haven't yet decided a clear procedure to contibute to this module. I guess the main contribution you can make for now is test it and open issues to help me chase the bugs. I will try to fix them as fast as I can while thinking of better implementation for performance gain and new handy features. If this package begins to get big attention, I might invite most interested people to participate in its design and development.

Note that further improvements regarding documentation are coming.