import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { DocGen } from './docgen.js';
import { HTTPRoute, WSRoute } from '../route.js';
import { DocSchemaTranslator, translateSchema, assertDocSchemaTranslators } from './docSchemaTranslator.js';
import { StandardSchemaV1 } from '../schema.js';
import { jsonSchemaToView, extractModels } from './jsonschema.js';
import { HTMLRouterRenderer } from './htmlRouteRenderer.js';
import { HTMLModelRenderer } from './htmlModelRenderer.js';
import { HTMLMenuRenderer } from './htmlMenuRenderer.js';
import { docgenCSS } from './style.js';
import { Model, Route as DocRoute, Router as DocRouter } from './types.js';

export type HTMLDocGenOptions = {
	outputDir : string;
	title? : string;
	// Per-call translators, taking precedence over the router registry
	translators? : Record<string, DocSchemaTranslator>;
	// Document schemas with no matching translator as 'any' instead of throwing
	lenient? : boolean;
};

const METHOD_DISPLAY : Record<string, string> = {
	get : 'GET', post : 'POST', put : 'PUT', patch : 'PATCH', del : 'DELETE', head : 'HEAD', options : 'OPTIONS', any : 'ANY'
};

/**
 * Generate a static HTML documentation from registered routes :
 * one page per route group (doc.tags[0]), one models page, and an index.
 */
export class HTMLDocGen implements DocGen {

	private _options : HTMLDocGenOptions;

	private _models : Map<string, Model> = new Map();

	private _translators : Map<string, DocSchemaTranslator> = new Map();

	constructor(options : HTMLDocGenOptions){
		this._options = options;
	}

	private schemaView(schema : StandardSchemaV1 | undefined) : string {
		if(!schema)
			return '';

		const jsonSchema = translateSchema(schema, this._translators);

		// Named definitions become linkable documentation models
		if(jsonSchema)
			for(const model of extractModels(jsonSchema))
				this._models.set(model.name, model);

		return jsonSchemaToView(jsonSchema);
	}

	private toDocRoute(route : HTTPRoute<any, any> | WSRoute<any, any>, method : string) : DocRoute {
		const schemas = 'schemas' in route ? route.schemas : undefined;

		return {
			method,
			path : route.pattern,
			summary : route.doc?.summary ?? '',
			description : route.doc?.description ?? '',
			body : this.schemaView(schemas?.Body),
			querystring : this.schemaView(schemas?.Query),
			responses : schemas?.Response ? [{status : 200, summary : '', content : this.schemaView(schemas.Response)}] : []
		};
	}

	private page(title : string, menu : string, content : string) : string {
		return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${title}</title>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/github.min.css">
	<style>${docgenCSS}</style>
</head>
<body>
${menu}
<div class="page">
${content}
</div>
</body>
</html>`;
	}

	async toDocumentation(httproutes : HTTPRoute<any, any>[], wsroutes : WSRoute<any, any>[], translators? : Map<string, DocSchemaTranslator>) : Promise<void> {
		// Router registry first, per-call translators option wins on conflict
		this._translators = new Map(translators);
		for(const [vendor, translator] of Object.entries(this._options.translators ?? {}))
			this._translators.set(vendor, translator);

		if(!this._options.lenient)
			assertDocSchemaTranslators(httproutes, this._translators);

		const title = this._options.title ?? 'API Documentation';

		// Group routes by their first tag
		const groups : Map<string, DocRoute[]> = new Map();
		const groupOf = (route : {doc? : {tags? : string[]}}) => route.doc?.tags?.[0] ?? 'API';

		for(const route of httproutes){
			const doc = this.toDocRoute(route, METHOD_DISPLAY[route.method] ?? route.method.toUpperCase());
			groups.set(groupOf(route), [...(groups.get(groupOf(route)) ?? []), doc]);
		}

		for(const route of wsroutes){
			const doc = this.toDocRoute(route, 'WS');
			groups.set(groupOf(route), [...(groups.get(groupOf(route)) ?? []), doc]);
		}

		const docRouters : DocRouter[] = [...groups.entries()].map(([name, routes]) => ({name, routes}));

		// Render router pages (models map already populated by toDocRoute)
		const routerRenderer = new HTMLRouterRenderer(this._models);
		const routerPages = routerRenderer.renderRouters(docRouters);

		// Render only the models actually referenced by routes
		const modelRenderer = new HTMLModelRenderer([...routerRenderer.usedModels]);
		const modelPages = modelRenderer.renderModelGroup([{name : 'Models', models : [...this._models.values()]}]);

		// Menu is rendered per depth so that relative links stay valid
		const menuRenderer = new HTMLMenuRenderer();
		const menuFor = (prefix : string) => {
			const map = new Map<string, {name : string, path : string}[]>();
			map.set('Routers', routerPages.map(page => ({name : page.name, path : `${prefix}router/${slugify(page.name)}.html`})));
			if(modelPages.length > 0)
				map.set('Models', modelPages.map(page => ({name : page.name, path : `${prefix}model/${slugify(page.name)}.html`})));
			return menuRenderer.render(map);
		};

		const outputDir = this._options.outputDir;
		await mkdir(join(outputDir, 'router'), {recursive : true});
		await mkdir(join(outputDir, 'model'), {recursive : true});

		for(const page of routerPages)
			await writeFile(join(outputDir, 'router', `${slugify(page.name)}.html`), this.page(`${title} - ${page.name}`, menuFor('../'), page.html));

		for(const page of modelPages)
			await writeFile(join(outputDir, 'model', `${slugify(page.name)}.html`), this.page(`${title} - ${page.name}`, menuFor('../'), page.html));

		await writeFile(join(outputDir, 'index.html'), this.page(title, menuFor(''), `<h1>${title}</h1>`));
	}
}

function slugify(name : string) : string {
	return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');
}
