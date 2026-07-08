import hljs from 'highlight.js'
import { Model, ModelGroup, ModelRenderer } from './types.js';

export class HTMLModelRenderer implements ModelRenderer{

	filter : string[] | undefined;

	constructor(filter? : string[]){
		this.filter = filter;
	}

	renderModel(model : Model) : string{
		let html = `<div class="model">`;
		html +=`<pre><code class="language-typescript"><div class="global">${hljs.highlight(model.view.replaceAll('\t', `   `), {language : "typescript"}).value}</div></code></pre>\n`;
		html += `</div>`;
		return html;
	}

	renderModelGroup(groups :  ModelGroup[]){
		const pages : {html : string, name : string}[] = [];
		for(let {name,models} of groups){
			const page = {
				html : `<h2 class="models">${name}</h2>\n<div class="models">`,
				name : name
			};
			
			if(!!this.filter)
				models = models.filter(model => this.filter?.includes(model.name));

			if(models.length <= 0)
				continue

			for(const model of models){
				page.html += this.renderModel(model);
			}
			
			page.html += `\n</div>\n`;
			pages.push(page);
		}

		return pages
	}
}