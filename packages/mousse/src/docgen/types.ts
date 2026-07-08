/**
 * Documentation rendering intermediate types.
 * Renderers consume these, whatever produced them (schema parser, openapi document...)
 */

export interface Model{
	name : string;
	// Code view of the model, printed as highlighted typescript
	view : string;
}

export interface ModelGroup{
	name : string;
	models : Model[];
}

export interface Response{
	status : number;
	summary : string;
	content : string;
}

export interface Route{
	method : string;
	path : string;
	summary : string;
	description : string;
	body : string;
	querystring : string;
	responses : Response[];
}

export interface Router{
	name : string;
	routes : Route[];
}

export interface HTMLPage{
	html : string;
	name : string;
}

export interface RouterRenderer{
	renderRoute(route : Route) : string;
	renderRouters(routers : Router[]) : HTMLPage[];
}

export interface ModelRenderer{
	renderModel(model : Model) : string;
	renderModelGroup(groups : ModelGroup[]) : HTMLPage[];
}
