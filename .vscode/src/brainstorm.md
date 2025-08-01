
Routes can have their path modified !
=> Way to evolve in route when register a middleware, recursively recreate routes based on existing one


Router can use other router => if they are instance then compile

SSE
=> 

WS
=> Have room
=> Possibility to join


// Validator
// Interface requiring validate / todoc
// Basic one using Zod

// Logger
// Interface 
// Give it to Context !

// Create documentation from App
// => based on schema provided


// ALLOW EACH ROUTE TO HAVE ITS OWN CONTEXT TYPE DEFINITION



So now i have ws routes with a context upgradable.
But how do I execute middlewares on this specific route before ?
I can't pass to http middleware a WSContext
Or I define 2 types of middleware : HTTP upgradable middleware avec un context upgradable et HTTP upgradable sans 

Ca peut être en realtime. Je passe au HTTPContext un booléen upgradable.
Vrai lorsque j'appelle les middlewares dans le upgrade des WS
Faux pour le reste des routes

Si on appelle upgrade et que c'est pas upgradable on throw une erreur
Si on appelle end ou writeStatus on passe upgradable à false !

Erreur actuellement dans mon WSContext, je considère avoir à la construction (dans le upgrade) accès à la websocket
Or je ne l'ai que dans les listeners !
Soit je conserve un WSContext complètement différent que je reconstruis après l'execution des middlewares... Mais middlewares pourrait ajouter des "on"
Soit je merge tout dans un seul WSContext !

