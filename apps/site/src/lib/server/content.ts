import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import hljs from 'highlight.js';
import { Marked, type Tokens } from 'marked';

const GITHUB = 'https://github.com/Tyrenn/mousse';

// Builds run from apps/site : the README and docs/ stay the single source of the content
const repoFile = (...path : string[]) => readFileSync(join(process.cwd(), '..', '..', ...path), 'utf8');

const escapeHtml = (text : string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function highlight(code : string, language? : string){
	const name = language?.split(/\s/)[0];
	const html = name && hljs.getLanguage(name) ? hljs.highlight(code, {language : name}).value : escapeHtml(code);
	return `<code class="hljs">${html}</code>`;
}

export type DocEntry = {slug : string, title : string, description : string};

/**
 * The documentation order comes from the README index
 */
export function docEntries() : DocEntry[] {
	const entries = [...repoFile('README.md').matchAll(/^\d+\. \[(.+?)\]\(docs\/(.+?)\.md\) — (.+)$/gm)]
		.map(([, title, slug, description]) => ({slug, title, description}));

	if(entries.length === 0)
		throw new Error('No documentation entry found in the README index');

	return entries;
}

function plainText(html : string){
	return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Same ids as GitHub : docs link to each other's sections
function slugify(text : string){
	return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

// Links are relative : every documentation page sits at /docs/<slug>/, whatever the base path
function rewriteHref(href : string){
	if(/^([a-z]+:|#)/.test(href))
		return href;

	const [path, hash] = href.split('#');
	const anchor = hash ? `#${hash}` : '';

	if(path.startsWith('../')){
		const target = path.slice(3);
		const kind = /\.\w+$/.test(target) ? 'blob' : 'tree';
		return `${GITHUB}/${kind}/main/${target}${anchor}`;
	}

	return `../${path.replace(/\.md$/, '')}/${anchor}`;
}

export type RenderedDoc = {title : string, html : string, toc : {id : string, text : string}[]};

export function renderDoc(slug : string) : RenderedDoc {
	// The navigation lines written for GitHub are replaced by the site's own
	const source = repoFile('docs', `${slug}.md`)
		.replace(/\r\n/g, '\n')
		.replace(/^\[« Documentation index\].*\n+/, '')
		.replace(/\n---\s*\n+\|[^\n]*\|\s*\n\|[:\- |]+\|\s*$/, '\n');

	const toc : RenderedDoc['toc'] = [];
	const seen = new Map<string, number>();
	let title = slug;

	const marked = new Marked({
		walkTokens(token){
			if(token.type === 'link')
				(token as Tokens.Link).href = rewriteHref((token as Tokens.Link).href);
		},
		renderer : {
			heading({tokens, depth}){
				const html = this.parser.parseInline(tokens);
				const text = plainText(html);

				if(depth === 1){
					title = text;
					return '';
				}

				const base = slugify(text);
				const count = seen.get(base) ?? 0;
				seen.set(base, count + 1);
				const id = count ? `${base}-${count}` : base;

				if(depth === 2)
					toc.push({id, text});

				return `<h${depth} id="${id}"><a href="#${id}">${html}</a></h${depth}>\n`;
			},
			code({text, lang}){
				return `<div class="code"><pre>${highlight(text, lang)}</pre><button type="button" class="copy" aria-label="Copy code">Copy</button></div>\n`;
			}
		}
	});

	const html = (marked.parse(source) as string)
		.replace(/<table>/g, '<div class="table-wrap"><table>')
		.replace(/<\/table>/g, '</table></div>');

	return {title, html, toc};
}

export type Benchmark = {name : string, requests : number, requestsLabel : string, average : string, p99 : string, highlighted : boolean};

/**
 * The results and their conditions stay in the README, where pnpm bench results are reported
 */
export function benchmarks() : Benchmark[] {
	const section = repoFile('README.md').replace(/\r\n/g, '\n').split('## Benchmarks')[1]?.split('\n## ')[0] ?? '';
	const rows = [...section.matchAll(/^\|(.+)\|(.+)\|(.+)\|(.+)\|$/gm)]
		.map((match) => match.slice(1, 5).map((cell) => cell.trim()))
		.filter(([, requests]) => /\d/.test(requests));

	if(rows.length === 0)
		throw new Error('No benchmark found in the README');

	return rows.map(([name, requests, average, p99]) => {
		const clean = (cell : string) => cell.replace(/\*/g, '');
		return {
			name : clean(name),
			requests : Number(clean(requests).replace(/\s/g, '')),
			requestsLabel : clean(requests),
			average : clean(average),
			p99 : clean(p99),
			highlighted : name.startsWith('**')
		};
	});
}
