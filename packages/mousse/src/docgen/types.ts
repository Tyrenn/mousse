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
	// Code (200) or range ('4xx')
	status : number | string;
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

// Turns typescript source into highlighted html
export type Highlighter = (code : string) => string;

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
