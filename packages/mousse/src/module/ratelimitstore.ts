import { createHash } from 'crypto';

/**
 * Settings of the limiter asking for an increment : a store may be shared by several limiters
 */
export type RateLimitStoreOptions = {
	// Milliseconds
	timeWindow : number;
	max : number;
	// Requests over the limit restart the window
	continueExceeding : boolean;
	// Requests over the limit double the window each time
	exponentialBackoff : boolean;
};

export type RateLimitState = {
	// Requests counted in the current window, this one included
	current : number;
	// Milliseconds left in the current window
	ttl : number;
};

/**
 * Where counters live. A window starts with the first request of a key and is fixed :
 * it does not slide, unless continueExceeding or exponentialBackoff renews it.
 */
export interface RateLimitStore {
	incr(key : string, options : RateLimitStoreOptions) : RateLimitState | Promise<RateLimitState>;
}

// Delay of the nth request over the limit, as a safe integer
export function backoffDelay(timeWindow : number, current : number, max : number){
	return Math.min(timeWindow * 2 ** (current - max - 1), Number.MAX_SAFE_INTEGER);
}

type LocalEntry = {
	current : number;
	expiresAt : number;
};

/**
 * In memory store : counters belong to this process. No timer involved, memory is bounded
 * by keeping the 'cache' most recently seen keys (a key pushed out starts over).
 */
export class LocalRateLimitStore implements RateLimitStore {

	private _cache : number;

	// A Map iterates in insertion order : its first key is the least recently seen
	private _entries : Map<string, LocalEntry> = new Map();

	constructor(cache : number = 5000){
		if(!Number.isInteger(cache) || cache < 1)
			throw new Error(`Invalid rate limit cache size '${cache}'`);

		this._cache = cache;
	}

	incr(key : string, options : RateLimitStoreOptions) : RateLimitState {
		const now = Date.now();
		let entry = this._entries.get(key);

		this._entries.delete(key);

		if(!entry || entry.expiresAt <= now)
			entry = {current : 0, expiresAt : now + options.timeWindow};

		entry.current++;

		if(entry.current > options.max){
			if(options.continueExceeding)
				entry.expiresAt = now + options.timeWindow;
			else if(options.exponentialBackoff)
				entry.expiresAt = now + backoffDelay(options.timeWindow, entry.current, options.max);
		}

		this._entries.set(key, entry);

		if(this._entries.size > this._cache)
			this._entries.delete(this._entries.keys().next().value!);

		return {current : entry.current, ttl : entry.expiresAt - now};
	}
}


/**
 * What the store needs from a Redis client, ioredis fits as is.
 * Set connectTimeout and maxRetriesPerRequest on it : a request waits for Redis to answer.
 */
export interface RateLimitRedisClient {
	eval(script : string, numKeys : number, ...args : (string | number)[]) : Promise<unknown>;
	evalsha(sha : string, numKeys : number, ...args : (string | number)[]) : Promise<unknown>;
}

// Atomic : increment and expiry cannot be split by a crash or by another instance
const INCR_SCRIPT = `
local key = KEYS[1]
local timeWindow = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local continueExceeding = ARGV[3] == 'true'
local exponentialBackoff = ARGV[4] == 'true'

local current = redis.call('INCR', key)

if current == 1 or (continueExceeding and current > max) then
	redis.call('PEXPIRE', key, timeWindow)
elseif exponentialBackoff and current > max then
	timeWindow = math.floor(math.min(timeWindow * (2 ^ (current - max - 1)), (2 ^ 53) - 1))
	redis.call('PEXPIRE', key, string.format('%.0f', timeWindow))
else
	timeWindow = redis.call('PTTL', key)
end

return {current, timeWindow}
`;

const INCR_SCRIPT_SHA = createHash('sha1').update(INCR_SCRIPT).digest('hex');

/**
 * Redis store : counters are shared by every instance of the application.
 */
export class RedisRateLimitStore implements RateLimitStore {

	private _redis : RateLimitRedisClient;

	private _prefix : string;

	constructor(redis : RateLimitRedisClient, prefix : string = 'mousse-rate-limit-'){
		this._redis = redis;
		this._prefix = prefix;
	}

	async incr(key : string, options : RateLimitStoreOptions) : Promise<RateLimitState> {
		const args = [this._prefix + key, options.timeWindow, options.max, String(options.continueExceeding), String(options.exponentialBackoff)];

		let result;
		try{
			result = await this._redis.evalsha(INCR_SCRIPT_SHA, 1, ...args);
		} catch(e : any) {
			// Redis does not know the script yet (first call, restart, flush) : eval loads it
			if(!String(e?.message).startsWith('NOSCRIPT'))
				throw e;
			result = await this._redis.eval(INCR_SCRIPT, 1, ...args);
		}

		const [current, ttl] = result as [number, number];
		return {current, ttl};
	}
}
