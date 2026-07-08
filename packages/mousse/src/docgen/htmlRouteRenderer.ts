import { HTMLPage, Model, Response, Route, Router, RouterRenderer } from "./types.js";
import hljs from 'highlight.js';



export class HTMLRouterRenderer implements RouterRenderer{

	models? : Map<string, Model>;
	usedModels : Set<string> = new Set();

	constructor(models? : Model[] | Map<string, Model>){
		if(models && Array.isArray(models)){
			this.models = new Map(models.map(model => [model.name, model]));
		}
		if(models && models instanceof Map){
			this.models = models;
		}
	}

	private addTab(str : string, nbTab : number){
		const tabs = '\t'.repeat(nbTab);
		return str.replaceAll('\n', `\n${tabs}`);
	}

	private renderCode(code : string, usedModels : Array<string> = []){
		const res : {html : string, usedModels : Set<string>} = {
			html : `<pre><code class="language-typescript"><div class="global">${hljs.highlight(code.replaceAll('\t', `   `), {language : "typescript"}).value}</div></code></pre>\n`,
			usedModels : new Set(usedModels)
		}
		
		const words = code.match(/([A-Za-z0-9_]+)/g);
		for(const word of (words ?? [])){
			if(this.models?.has(word) && !res.usedModels.has(word)){
				res.usedModels = new Set([...res.usedModels, word]);
				const subres = this.renderCode(this.models.get(word)?.view ?? "", [...res.usedModels]);
				res.usedModels = new Set([...res.usedModels, ...subres.usedModels]);
				res.html += subres.html;
			}
		}

		return res;
	}

	private renderRouteResponse(response : Response){
		const code = this.renderCode(response.content);
		
		return {
			html : 	`<div class="response ${response.status > 299 ? 'error' : 'success'}">\n`
					+ 	`	<details>\n`
					+ 	`		<summary>\n`
					+ 	`			<div class="title">\n`
					+ 	`				<div class="status">${response.status}</div>\n`
					+ 	`				<p class="message">${response.summary.length > 0 ? response.summary : (response.status > 299 ? 'Error' : 'Ok')}</p>\n`
					+ 	`			</div>\n`
					+ 	`		</summary>\n`
					+ 	`		${this.addTab(code.html, 2)}\n`
					+ 	`	</details>\n`
					+ 	`</div>\n`,
			usedModels : code.usedModels
		}
	}

	renderRoute(route : Route) : string {
		let bodyHTML : string = "";
		let querystringHTML : string = "";
		let responsesHTML : string = "";
		let usedModels : Set<string> = new Set();

		if(route.body.length > 0){
			const rendered = this.renderCode(route.body);
			bodyHTML = `<h4>Body</h4>\n${rendered.html}`
			usedModels = new Set([...usedModels, ...rendered.usedModels]);
		}

		if(route.querystring.length > 0){
			const rendered = this.renderCode(route.querystring);
			querystringHTML = `<h4>Querystring</h4>\n${rendered.html}`
			usedModels = new Set([...usedModels, ...rendered.usedModels]);
		}

		if(route.responses.length > 0){
			responsesHTML = '<h4>Responses</h4>';
			for(const response of route.responses){
				const rendered = this.renderRouteResponse(response);
				responsesHTML += rendered.html;
				usedModels = new Set([...usedModels, ...rendered.usedModels]);
			}
		}

		this.usedModels = new Set([...this.usedModels, ...usedModels]);

		return 	`<div class="route ${route.method}">\n`
				+	`	<details>\n`
				+	`		<summary>\n`
				+	`			<div class="title">\n`
				+	`				<div class="verb">${route.method}</div>\n`
				+	`				<h3 class="path">${route.path}</h3>\n`
				+	`				<p class="summary">${route.summary}</p>\n`
				+	`			</div>\n`
				+	`		</summary>\n`
				+	`		<p class="description">\n`
				+	`			${this.addTab(route.description, 3)}\n`
				+	`		</p>\n`
				+	`		${this.addTab(bodyHTML, 2)}\n`
				+	`		${this.addTab(querystringHTML, 2)}\n`
				+	`		${this.addTab(responsesHTML, 2)}\n`
				+	`	</details>\n`
				+	`</div>`
	}

	renderRouters(routers : Router[]) : HTMLPage[]{
		const pages : HTMLPage[] = [];

		for(const router of routers){
			const page = {
				html : `<h2 class="router">${router.name}</h2>\n<div class="router">`,
				name : router.name
			};

			for(const route of router.routes){
				const html = this.renderRoute(route);
				page.html += html;
			}
			page.html += `\n</div>\n`;
			pages.push(page);
		}

		return pages
	}


}