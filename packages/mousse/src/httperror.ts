/**
 * Error carrying an HTTP status. Thrown from a handler or a middleware, it is answered
 * with this status and a json {error : message} body, unless an httpErrorHandler takes over.
 */
export class HTTPError extends Error {
	statusCode : number;

	constructor(statusCode : number, message? : string){
		super(message ?? `HTTP ${statusCode}`);
		this.name = 'HTTPError';
		this.statusCode = statusCode;
	}
}

/**
 * Request body the BodyParser could not parse (malformed json...)
 */
export class BodyParseError extends HTTPError {
	cause? : unknown;

	constructor(cause? : unknown){
		super(400, 'Malformed body');
		this.name = 'BodyParseError';
		this.cause = cause;
	}
}

/**
 * Request body larger than the route bodyLimit (declared content-length or received bytes)
 */
export class PayloadTooLargeError extends HTTPError {
	limit : number;

	constructor(limit : number){
		super(413, 'Payload too large');
		this.name = 'PayloadTooLargeError';
		this.limit = limit;
	}
}

/**
 * What a rate limiter knows about a request it rejects
 */
export type RateLimitErrorContext = {
	statusCode : 429 | 403;
	ban : boolean;
	max : number;
	// Milliseconds left in the window
	ttl : number;
	// The same as a readable duration : '1 minute'
	after : string;
};

/**
 * Request rejected by a rate limiter : 429, or 403 once banned
 */
export class RateLimitError extends HTTPError {
	ban : boolean;
	max : number;
	ttl : number;
	after : string;

	constructor(context : RateLimitErrorContext){
		super(context.statusCode, `Rate limit exceeded, retry in ${context.after}`);
		this.name = 'RateLimitError';
		this.ban = context.ban;
		this.max = context.max;
		this.ttl = context.ttl;
		this.after = context.after;
	}
}
