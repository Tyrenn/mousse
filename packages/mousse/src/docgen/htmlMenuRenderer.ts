

export class HTMLMenuRenderer{
	render(map : Map<string, {name : string, path : string}[]>){
		let html = `<div id="index">\n`;
		for(const [name, pages] of map){
			html += 	`	<div class="title">${name}</div>\n`
					+	`${pages.map(page => `		<a href="${page.path}">${page.name}</a>`).join(`\n`)}`
		}
		html += `</div>`;

		return html;
	}

}