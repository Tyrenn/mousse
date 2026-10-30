import { error } from '@sveltejs/kit';
import { docEntries, renderDoc } from '#lib/server/content.ts';

export function entries(){
	return docEntries().map(({slug}) => ({slug}));
}

export function load({params}){
	if(!docEntries().some(({slug}) => slug === params.slug))
		error(404, 'Not found');

	return {doc : renderDoc(params.slug)};
}
