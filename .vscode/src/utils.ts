export function joinUri(patternParent : string, patternChild : string) {
	return `${patternParent.replace(/\/+$/, '')}/${patternChild.replace(/^\/+/, '')}`;
}