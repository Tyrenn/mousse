
=> Allow Default context extension in app !

=> Route options
* Serializer (Possibly none)
	=> 
	=> Handled with a middleware ?

* SchemaValidator
	=> Validation of body
	=> Handled with a middleware ?

* SchemaParser
	=> Pour la documentation

* Default context type
=> Give Routes options depending on method used ?

=> Create a class Route which contains options and doc ?

=> Keep routes in an mousse attribute ?
	=> Be able to call test / document on it...


/!\ Different behaviour between Router and Mousse instance
=> Router will save all middlewares until their usage in mousse instance
=> As such, middleware registration order has no impact. All registered middlewares will be applied to all route even though routes are registered after middleware registration

=> Mousse register routes directly so if a route A is registered before a middleware, that last middleware will not be active on the route A.

=> SHOULD normalize behavior.
Either find a way to make the order impactful on router OR consider mousse instance as a router.

For now no idea for the first solution.... Is it a good behavior ?

For the second solution we could extends router class and actually register routes before server RUN, with a build step.

Mousse options:
=> Serializer
=> Default response headers
=> 

