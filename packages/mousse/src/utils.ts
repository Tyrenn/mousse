export function joinUri(patternParent : string, patternChild : string) {
	return `${patternParent.replace(/\/+$/, '')}/${patternChild.replace(/^\/+/, '')}`;
}

/**
 * Check if a route pattern belongs to a middleware pattern scope.
 * Matches on full segment boundaries : '/user' matches '/user' and '/user/me' but not '/users'.
 * An empty pattern matches everything.
 */
export function matchPattern(pattern : string | undefined, route : string) : boolean {
	if(!pattern)
		return true;

	const base = pattern.replace(/\/+$/, '');

	return route === base || route === pattern || route.startsWith(`${base}/`);
}

/**
 * Copy of obj without its undefined properties, so spreading it does not override defined defaults.
 */
export function definedProps<T extends object>(obj : T) : Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function parseQueryString(query: string){
	const result: Record<string, string | string[]> = {};
	const parts = query.split('&');

	const decode = (str : string) => {
		try {
			return decodeURIComponent(str.replaceAll('+', ' '));
		} catch {
			return str;
		}
	};

	for(const p of parts){
		if(!p)
			continue;

		// Only split on the first '=' so values containing '=' are preserved
		const separatorIndex = p.indexOf('=');
		const k = separatorIndex === -1 ? p : p.slice(0, separatorIndex);
		const v = separatorIndex === -1 ? '' : p.slice(separatorIndex + 1);

		const dkey = decode(k);
		const key = dkey.slice(-2) === '[]' ? dkey.slice(0, -2) : dkey;
		const val = decode(v);

		if (result[key] === undefined)
			result[key] = val;
		else if (Array.isArray(result[key]))
			result[key].push(val);
		else
			result[key] = [result[key], val];
	}

	return result;
}