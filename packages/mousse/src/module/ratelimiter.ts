import { Context, SustainableContext, UpgradableContext } from '../context.js';
import { HTTPError, RateLimitError, RateLimitErrorContext } from '../httperror.js';
import { formatDuration, ipKey, parseTimeWindow } from '../utils.js';
import { LocalRateLimitStore, RateLimitRedisClient, RateLimitStore, RedisRateLimitStore } from './ratelimitstore.js';

/**
 * What every route kind (get, post, ws upgrade...) has in common : a limiter fits on all of them.
 */
export type RateLimitContext = Omit<Context<any>, 'body' | keyof SustainableContext | keyof UpgradableContext>;

export interface RateLimiter{

	/**
	 * Called before anything of the request is analysed : schemas, body and middlewares come after.
	 * Throw (an HTTPError usually) or answer through the context to reject the request.
	 * @param c
	 */
	check(c : RateLimitContext) : void | Promise<void>;
}

type HeaderToggles = Record<string, boolean>;

export type DefaultRateLimiterOptions = {
	// Requests allowed per client per window, 1000 by default
	max? : number | ((c : RateLimitContext, key : string) => number | Promise<number>);

	// Milliseconds or a string such as '10s' or '1 minute'. 1 minute by default. A function returns milliseconds
	timeWindow? : number | string | ((c : RateLimitContext, key : string) => number | Promise<number>);

	// Identifies the client. By default c.ip, IPv6 addresses being masked to ipv6Subnet
	keyGenerator? : (c : RateLimitContext) => string | Promise<string>;

	// Prefix length of the default keyGenerator, 64 by default
	ipv6Subnet? : number;

	// Keys never limited nor counted
	allowList? : string[] | ((c : RateLimitContext, key : string) => boolean | Promise<boolean>);

	// Requests answered 429 beyond max before the answer becomes 403, disabled by default (-1)
	ban? : number;

	// Requests over the limit restart the window
	continueExceeding? : boolean;

	// Requests over the limit double the window each time. continueExceeding takes priority
	exponentialBackoff? : boolean;

	// A failing store lets requests through instead of failing them
	skipOnError? : boolean;

	// Counters location, a LocalRateLimitStore by default
	store? : RateLimitStore;

	// Shorthand for store : new RedisRateLimitStore(redis)
	redis? : RateLimitRedisClient;

	// Required to tell apart several limiters sharing a store or a redis client
	nameSpace? : string;

	// Size of the default LocalRateLimitStore, 5000 keys by default
	cache? : number;

	// ratelimit-* headers instead of x-ratelimit-*
	enableDraftSpec? : boolean;

	// Headers of requests under the limit, keyed by name. Limit, remaining and reset by default
	addHeadersOnExceeding? : HeaderToggles;

	// Headers of rejected requests, keyed by name. Limit, remaining, reset and retry-after by default
	addHeaders? : HeaderToggles;

	// Builds the error thrown on rejection, a RateLimitError by default
	errorResponseBuilder? : (c : RateLimitContext, context : RateLimitErrorContext) => HTTPError;

	// Request under the limit
	onExceeding? : (c : RateLimitContext, key : string) => void;

	// Request over the limit
	onExceeded? : (c : RateLimitContext, key : string) => void;

	// Request over the ban threshold
	onBanReach? : (c : RateLimitContext, key : string) => void;
};

// Name spaces in use per store or redis client
const nameSpaces = new WeakMap<object, Set<string>>();

/**
 * Fixed window rate limiter. An instance owns its counters : every route it is set on shares them,
 * and two instances never do.
 */
export class DefaultRateLimiter implements RateLimiter{

	private _options : DefaultRateLimiterOptions;

	private _max : number | ((c : RateLimitContext, key : string) => number | Promise<number>);

	private _timeWindow : number | ((c : RateLimitContext, key : string) => number | Promise<number>);

	private _ban : number;

	private _nameSpace : string;

	private _keyGenerator : (c : RateLimitContext) => string | Promise<string>;

	private _store : RateLimitStore;

	private _labels : {limit : string, remaining : string, reset : string, retryAfter : string};

	private _headersUnderLimit : HeaderToggles;

	private _headersOverLimit : HeaderToggles;

	// A request reaching the same limiter twice (route option and middleware, say) counts once
	private _seen : WeakSet<object> = new WeakSet();


	constructor(options : DefaultRateLimiterOptions = {}){
		const {max = 1000, ipv6Subnet = 64, ban = -1, nameSpace = ''} = options;

		if(typeof max === 'number' && (!Number.isFinite(max) || max < 0))
			throw new Error(`Invalid rate limit max '${max}'`);

		if(!Number.isInteger(ipv6Subnet) || ipv6Subnet < 0 || ipv6Subnet > 128)
			throw new Error(`Invalid rate limit ipv6Subnet '${ipv6Subnet}'`);

		this._options = options;
		this._max = typeof max === 'number' ? Math.trunc(max) : max;
		this._timeWindow = typeof options.timeWindow === 'function' ? options.timeWindow : parseTimeWindow(options.timeWindow ?? 60000);
		this._ban = ban;
		this._nameSpace = nameSpace;
		this._keyGenerator = options.keyGenerator ?? ((c) => ipKey(c.ip, ipv6Subnet));

		// Two limiters on the same counters would add up their requests without any visible error
		const backend = options.store ?? options.redis;
		if(backend){
			const used = nameSpaces.get(backend) ?? new Set<string>();
			if(used.has(nameSpace))
				throw new Error(`Rate limit nameSpace '${nameSpace}' is already used on this store : give each limiter its own, or reuse the same limiter to share its counters`);
			nameSpaces.set(backend, used.add(nameSpace));
		}

		this._store = options.store ?? (options.redis ? new RedisRateLimitStore(options.redis) : new LocalRateLimitStore(options.cache));

		const prefix = options.enableDraftSpec ? 'ratelimit' : 'x-ratelimit';
		this._labels = {limit : `${prefix}-limit`, remaining : `${prefix}-remaining`, reset : `${prefix}-reset`, retryAfter : 'retry-after'};

		const base = {[this._labels.limit] : true, [this._labels.remaining] : true, [this._labels.reset] : true};
		this._headersUnderLimit = {...base, ...options.addHeadersOnExceeding};
		this._headersOverLimit = {...base, [this._labels.retryAfter] : true, ...options.addHeaders};
	}

	private _writeHeaders(c : RateLimitContext, toggles : HeaderToggles, limit : number, remaining : number, ttlInSeconds : number){
		if(toggles[this._labels.limit])
			c.header(this._labels.limit, String(limit));
		if(toggles[this._labels.remaining])
			c.header(this._labels.remaining, String(remaining));
		if(toggles[this._labels.reset])
			c.header(this._labels.reset, String(ttlInSeconds));
		if(toggles[this._labels.retryAfter])
			c.header(this._labels.retryAfter, String(ttlInSeconds));
	}

	async check(c : RateLimitContext){
		if(this._seen.has(c))
			return;
		this._seen.add(c);

		const {allowList, continueExceeding = false, exponentialBackoff = false} = this._options;

		const key = await this._keyGenerator(c);

		if(Array.isArray(allowList) ? allowList.includes(key) : await allowList?.(c, key))
			return;

		const limit = typeof this._max === 'number' ? this._max : await this._max(c, key);
		const timeWindow = typeof this._timeWindow === 'number' ? this._timeWindow : await this._timeWindow(c, key);

		let state;
		try{
			state = await this._store.incr(this._nameSpace + key, {timeWindow, max : limit, continueExceeding, exponentialBackoff});
		} catch(e) {
			if(this._options.skipOnError)
				return;
			throw e;
		}

		const ttlInSeconds = Math.ceil(state.ttl / 1000);

		if(state.current <= limit){
			this._writeHeaders(c, this._headersUnderLimit, limit, limit - state.current, ttlInSeconds);
			this._options.onExceeding?.(c, key);
			return;
		}

		this._options.onExceeded?.(c, key);
		this._writeHeaders(c, this._headersOverLimit, limit, 0, ttlInSeconds);

		const banned = this._ban !== -1 && state.current - limit > this._ban;
		if(banned)
			this._options.onBanReach?.(c, key);

		const errorContext : RateLimitErrorContext = {
			statusCode : banned ? 403 : 429,
			ban : banned,
			max : limit,
			ttl : state.ttl,
			after : formatDuration(ttlInSeconds * 1000)
		};

		// Used as a middleware of an .sse() route, the stream is already open : the status is gone, only closing is left
		const context = c as unknown as Context<any>;
		if(context.sustained)
			context.respond();

		throw this._options.errorResponseBuilder?.(c, errorContext) ?? new RateLimitError(errorContext);
	}
}
