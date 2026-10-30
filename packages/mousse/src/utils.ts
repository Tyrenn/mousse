import { BlockList, isIP } from 'net';

export function joinUri(patternParent : string, patternChild : string) {
	const joined = `${patternParent.replace(/\/+$/, '')}/${patternChild.replace(/^\/+/, '')}`;

	// No trailing slash : a '/' route mounted on '/users' must answer GET /users
	return joined.replace(/\/+$/, '') || '/';
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

/**
 * Proxy trust setting : true trusts every proxy, a list holds IPs, CIDR ranges or the
 * 'loopback' / 'private' / 'linklocal' aliases, a function decides per address
 */
export type TrustProxy = boolean | string[] | ((ip : string) => boolean);

const TRUST_ALIASES : Record<string, string[]> = {
	loopback : ['127.0.0.0/8', '::1/128'],
	private : ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
	linklocal : ['169.254.0.0/16', 'fe80::/10']
};

/**
 * Compile a TrustProxy setting into a predicate. Invalid entries throw immediately.
 */
export function compileTrustProxy(trust? : TrustProxy) : (ip : string) => boolean {
	if(typeof trust === 'function')
		return trust;

	if(!trust || (Array.isArray(trust) && trust.length === 0))
		return () => false;

	if(trust === true)
		return () => true;

	const list = new BlockList();
	for(const entry of trust.flatMap(entry => TRUST_ALIASES[entry] ?? [entry])){
		const [address, prefix] = entry.split('/');
		const family = isIP(address);
		if(!family)
			throw new Error(`Invalid trustProxy entry '${entry}'`);

		if(prefix === undefined)
			list.addAddress(address, family === 6 ? 'ipv6' : 'ipv4');
		else
			list.addSubnet(address, Number(prefix), family === 6 ? 'ipv6' : 'ipv4');
	}

	return (ip : string) => {
		const family = isIP(ip);
		return family !== 0 && list.check(ip, family === 6 ? 'ipv6' : 'ipv4');
	};
}

/**
 * Turn the address text reported by uWS into its usual form :
 * IPv4-mapped addresses become dotted IPv4, IPv6 is compressed ('::1')
 */
export function normalizeIp(address : string) : string {
	if(!address.includes(':'))
		return address;

	const groups = address.toLowerCase().split(':');
	if(groups.length !== 8)
		return address;

	const values = groups.map(group => parseInt(group, 16));

	// ::ffff:a.b.c.d
	if(values.slice(0, 5).every(v => v === 0) && values[5] === 0xffff)
		return [values[6] >> 8, values[6] & 0xff, values[7] >> 8, values[7] & 0xff].join('.');

	// Longest run of zero groups (at least two) collapses into '::'
	let bestStart = -1, bestLength = 0;
	for(let i = 0; i < 8; i++){
		let j = i;
		while(j < 8 && values[j] === 0)
			j++;
		if(j - i > bestLength && j - i > 1){
			bestStart = i;
			bestLength = j - i;
		}
		i = j;
	}

	const hex = values.map(v => v.toString(16));
	if(bestStart === -1)
		return hex.join(':');

	return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLength).join(':')}`;
}
const UNITS : Record<string, number> = {
	ms : 1, msec : 1, msecs : 1, millisecond : 1, milliseconds : 1,
	s : 1000, sec : 1000, secs : 1000, second : 1000, seconds : 1000,
	m : 60000, min : 60000, mins : 60000, minute : 60000, minutes : 60000,
	h : 3600000, hr : 3600000, hrs : 3600000, hour : 3600000, hours : 3600000,
	d : 86400000, day : 86400000, days : 86400000
};

/**
 * Turn a time window into milliseconds : a number of milliseconds, or a string such as '10s', '1 minute', '2 hours'.
 * Invalid values throw immediately.
 */
export function parseTimeWindow(value : number | string) : number {
	let ms = typeof value === 'number' ? value : NaN;

	if(typeof value === 'string'){
		const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(value);
		const unit = match ? (match[2] ? UNITS[match[2].toLowerCase()] : 1) : undefined;
		if(match && unit)
			ms = Number(match[1]) * unit;
	}

	if(!Number.isFinite(ms) || ms <= 0)
		throw new Error(`Invalid rate limit time window '${value}'`);

	return Math.ceil(ms);
}

/**
 * Human readable duration, rounded up : a client told to retry in '2 minutes' is never too early
 */
export function formatDuration(ms : number) : string {
	const units : [number, string][] = [[86400000, 'day'], [3600000, 'hour'], [60000, 'minute'], [1000, 'second']];

	for(const [size, name] of units){
		if(ms >= size || size === 1000){
			const count = Math.max(1, Math.ceil(ms / size));
			return `${count} ${name}${count > 1 ? 's' : ''}`;
		}
	}

	return '1 second';
}

/**
 * Key of a client address. IPv4-mapped addresses become IPv4, and IPv6 addresses are masked to their
 * subnet : a single client usually owns a whole /64 and could otherwise get a new counter per address.
 */
export function ipKey(ip : string, ipv6Subnet : number = 64) : string {
	// Zone index ('fe80::1%eth0') is meaningless here
	const address = ip.split('%')[0].toLowerCase();

	if(isIP(address) !== 6)
		return address;

	const [head, tail] = address.split('::');
	const toGroups = (part? : string) => (part ? part.split(':') : []).flatMap((group) => {
		if(!group.includes('.'))
			return [parseInt(group, 16)];

		// Trailing dotted IPv4 ('::ffff:1.2.3.4') holds two groups
		const [a, b, c, d] = group.split('.').map(Number);
		return [(a << 8) | b, (c << 8) | d];
	});

	const start = toGroups(head);
	const end = toGroups(tail);
	const groups = [...start, ...new Array(Math.max(0, 8 - start.length - end.length)).fill(0), ...end];

	if(groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff)
		return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');

	const masked = groups.map((group, i) => {
		const bits = Math.min(16, Math.max(0, ipv6Subnet - i * 16));
		return (group & (0xffff << (16 - bits))).toString(16);
	});

	return `${masked.join(':')}/${ipv6Subnet}`;
}
