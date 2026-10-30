import { docEntries } from '#lib/server/content.ts';

export function load(){
	return {docs : docEntries()};
}
