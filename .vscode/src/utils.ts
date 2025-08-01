export function joinUri(patternParent : string, patternChild : string) {
	return `${patternParent.replace(/\/+$/, '')}/${patternChild.replace(/^\/+/, '')}`;
}

export function parseQuery(query: string){
	const result: Record<string, string | string[]> = {};
	const parts = query.split('&');

	for(const p of parts){
		const [k, v] = p.split('=');
		const dkey = decodeURIComponent(k);
		const key = dkey.slice(-2) === '[]' ? dkey.slice(0, -2) : dkey;
		const val = decodeURIComponent(v);
		
		if (result[key] === undefined) 
			result[key] = val;
		else if (Array.isArray(result[key]))
			result[key].push(val);
		else 
			result[key] = [result[key], val];
	}

	return result;
}