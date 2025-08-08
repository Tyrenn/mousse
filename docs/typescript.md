# Working with Types

## Context Types

> WIP

## Extend Context Type

With Mousse it is pretty easy to extend Context Type with additionals properties. You basically define your type in the route method generic :

```ts

type ContextExtension = {
	myAdditionalProp : boolean;
	myAdditionalFunction : () => void;
}

app.get<Types, ContextExtension>('/', 
	// A middleware can now extends context
	(c) => {
		c.myAdditionalProp = true;
		c.myAdditionalFunction = () => console.log('Hello');
	},
	(c) => {
		// No type errors
		console.log(c.myAdditionalProp);
		c.myAdditionalFunction();
	})
```

You can also define the extension in a router generic, to specify that every routes in the router has an extended context :

```ts



```
?? Define only if pattern is '' ?
?? Allow not using pattern ?

Finally, defining a context extension in the `use` method is pretty special as it will change the extension definition of the returned app or router IF you don't specify a pattern or use the general `''` one :

```ts

	let router = new Router<any, ContextExtension>();

	router = router.use('', )
```
