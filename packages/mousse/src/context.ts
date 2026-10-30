import { RecognizedString, HttpRequest as uHttpRequest, HttpResponse as uHttpResponse, us_socket_context_t as uWSSocketContext, WebSocket as uWSWebSocket } from 'uWebSockets.js';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import mime_types from "mime-types";
import {STATUS_CODES} from 'http'
import type { Mousse } from './mousse.js';
import { parseQueryString, normalizeIp } from './utils.js';
import { BodyParseError, HTTPError, PayloadTooLargeError } from './httperror.js';
import { BodyParser } from './module/bodyparser.js';
import { ResponseSerializer } from './module/responseserializer.js';
import { Logger } from './module/logger.js';
import { HTTPRouteMethod } from './route.js';
import { Schemas, StandardSchemaV1, responseSchemaFor, validateSchema, validateSchemaSync } from './schema.js';

/**
 * Data carried by each websocket connection
 */
export type WebSocketUserData = {
	handlers : Partial<WebSocketEventHandlers>;
	maxBackPressure : number;
	bufferQueue : RecognizedString[];
	// Request data snapshotted at upgrade time, exposed by WSContext once connected
	snapshot : {
		params : Record<string, string>;
		query : Record<string, any>;
		headers : Record<string, string>;
		url : string;
		route : string;
		ip : string;
	};
};

// Fastify's default
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

/**
 * Enhanced websocket
 */
export type WebSocket = uWSWebSocket<WebSocketUserData>;

/**
 * Websocket listenable event keys and their handler type
 */
export type WebSocketEventHandlers = {
	'message' : (ws : WebSocket, message : ArrayBuffer, isBinary? : boolean) => void | Promise<void>;
	'close' : (ws : WebSocket, code: number, message: ArrayBuffer) => void;
	'drain' : (ws : WebSocket) => void;
	'dropped' : (ws : WebSocket, message : ArrayBuffer, isBinary? : boolean) => void | Promise<void>;
	'open' : (ws : WebSocket) => void | Promise<void>;
	'ping' : (ws : WebSocket, message : ArrayBuffer) => void | Promise<void>;
	'pong' : (ws : WebSocket, message : ArrayBuffer) => void | Promise<void>;
	'subscription' : (ws : WebSocket, topic: ArrayBuffer, newCount: number, oldCount: number) => void;
};

export type ContextTypes = {
	Body? : any;
	Response? : any;
	// Non 2xx responses c.json() accepts along with a status (inferred from a ResponseSchemaMap)
	ErrorResponse? : any;
	Query? : any;
	Params? : string;
}

export type DefaultContextTypes = {Body : any, Response : any};

type ErrorResponseOf<Types extends ContextTypes> = Types extends {ErrorResponse : infer E} ? E : never;

export type CompiledSerializer = (res : any) => string | Buffer | ArrayBuffer;

/**
 * Outcome of a request handed to onResponse hooks
 */
export type ResponseInfo = {
	statusCode : number;
	// Milliseconds between the context creation and the end of the response
	elapsedTime : number;
	// The client went away before the response ended (also how an SSE stream closed by the client ends)
	aborted : boolean;
};

export type ResponseHook = (c : Context<any>, info : ResponseInfo) => void | Promise<void>;

/**
 * Runs before anything of the request is analysed : schemas are not applied yet, so params and query are raw.
 * Answering through the context or throwing ends the request.
 */
export type RequestHook = (c : Context<any>) => void | Context<any> | Promise<void | Context<any>>;

// Pattern is string if types is undefined and :str/... if defined


export interface UpgradableContext{
	upgradable : boolean;
	upgraded : boolean;
	wsEventHandlers : Partial<WebSocketEventHandlers>;
	on : <Event extends keyof WebSocketEventHandlers>(type: Event, listener: WebSocketEventHandlers[Event]) => void;
	off : <Event extends keyof WebSocketEventHandlers>(type : Event) => void;
	onMessage : (listener : WebSocketEventHandlers["message"]) => void;
	onClose : (listener : WebSocketEventHandlers["close"]) => void;
	onDrain : (listener : WebSocketEventHandlers["drain"]) => void;
	onDropped : (listener : WebSocketEventHandlers["dropped"]) => void;
	onOpen : (listener : WebSocketEventHandlers["open"]) => void;
	onPing : (listener : WebSocketEventHandlers["ping"]) => void;
	onPong : (listener : WebSocketEventHandlers["pong"]) => void;
	onSubscription : (listener : WebSocketEventHandlers["subscription"]) => void;
	upgrade : () => void;
};

/**
 * SSE frame fields sent along with the data
 */
export type SSEEventOptions = {
	// Event type, dispatched to addEventListener(event) on the client
	event? : string;
	// Last event id, sent back by the client as last-event-id when reconnecting
	id? : string | number;
	// Client reconnection delay in milliseconds
	retry? : number;
};

export type SustainOptions = {
	// Send a comment frame every heartbeat milliseconds, keeping proxies from closing an idle stream
	heartbeat? : number;
};

export interface SustainableContext{
	sustain : (options? : SustainOptions) => void;
	sustained : boolean;
	send : (data : string | object, options? : SSEEventOptions) => void;
	ping : () => void;
}




export class Context<Types extends ContextTypes = DefaultContextTypes> implements UpgradableContext, SustainableContext{


	// The mousse instance that has created the context
	private _mousse : Mousse;

	private _logger? : Logger;



// 🌐 --- Request related attributes

	// uWebSocket.js request
	private _ureq : uHttpRequest;

	// Actual request method snapshotted at construction ('get', 'post', 'delete'...)
	private _method : string;

	// Request url and query string snapshotted at construction
	private _url : string;
	private _queryString : string;

	// The route pattern
	private _route : string;

	private _bodyRaw? : Buffer;

	private _bodyParsed? : Types["Body"];

	// Body chunks are consumed as soon as the context is built, otherwise uWS drops
	// any chunk arriving before onData is attached (typically after an await)
	private _bodyRawPromise? : Promise<Buffer>;

	private _bodyReject? : (reason : Error) => void;

	private _bodyLimit : number;

	// Set once the body (declared or received) exceeds the limit. Remaining chunks are read and dropped :
	// closing the socket mid-upload makes clients reset before reading the 413
	private _bodyTooLarge : boolean = false;

	//
	private _schemas? : Schemas;


	private _bodyParser : BodyParser<any>;

	private _responseSerializer : ResponseSerializer<any>;

	// ResponseSerializer.compile() output per response schema, built at route registration
	private _compiledSerializers? : Map<StandardSchemaV1, CompiledSerializer>;


	// Populated param
	private _params: Record<string, string> = {};

	// Parsed (and possibly schema validated) query, cached
	private _query? : Record<string, any>;

	// Request headers
	private _reqHeaders : Record<string, string> = {};

	// Address of the socket peer (the last proxy when behind one)
	private _remoteAddress : string;

	// Socket peer followed by the trusted x-forwarded-for hops, right to left. Computed on first access
	private _proxyChain? : string[];



// 🌐 -- Response related attributes

	// uWebSocket.js response
	private _ures : uHttpResponse;

	// Response headers, an array value is written as one header line per entry (set-cookie)
	private _headers : Record<string, string | string[]> = {};

   // Returns the custom HTTP underlying status code of the response.
	private _statusCode : number = 200;

   // Returns the custom HTTP underlying status code message of the response.
   private _statusMessage? : string = undefined;

	// Flag if response has been sent
	private _ended : boolean = false;

	// Flag if the client went away before the response ended : ures must not be touched anymore
	private _aborted : boolean = false;

	// Callbacks run once on abort : file streams, onAbort listeners
	private _abortHandlers : (() => void)[] = [];

	// Request start, for onResponse elapsedTime
	private _startTime : bigint = process.hrtime.bigint();

	private _responseHooks : ResponseHook[];

	// onResponse hooks already ran
	private _finished : boolean = false;



// -- SSE related attributes


	private _sustainable : boolean = false;

	private _sustained : boolean = false;

	// Fully formatted frames waiting for the socket
	private _eventQueue : string[] = [];

	private _isDraining : boolean = false;

	private _heartbeat? : NodeJS.Timeout;



// -- WS related attributes

	private _upgradable : boolean = false;

	//
	private _upgraded : boolean = false;

	//
	private _wsEventHandlers : Partial<WebSocketEventHandlers> = {};

	private _socketContext : uWSSocketContext | undefined;

	private _maxBackPressure : number;




	constructor(
		mousse : Mousse, req : uHttpRequest, res : uHttpResponse, route : string, params : string[], 
		bodyParser : BodyParser<any>, responseSerializer : ResponseSerializer<any>, logger? : Logger,
		http? : {method? : HTTPRouteMethod, schemas? : Schemas, bodyLimit? : number, compiledSerializers? : Map<StandardSchemaV1, CompiledSerializer>},
		ws? : {socket? : uWSSocketContext, maxBackPressure? : number},
		responseHooks? : ResponseHook[]
	) {
		this._mousse = mousse;

		this._ureq = req;
		this._ures = res;
		this._route = route;

		this._bodyParser = bodyParser;
		this._responseSerializer = responseSerializer;
		this._logger = logger;
		this._responseHooks = responseHooks ?? [];

		this._schemas = http?.schemas;
		this._bodyLimit = http?.bodyLimit ?? DEFAULT_BODY_LIMIT;
		this._compiledSerializers = http?.compiledSerializers;
		this._sustainable = !!http?.method && (['get', 'patch', 'post', 'put'] as HTTPRouteMethod[]).includes(http?.method);

		this._upgradable = !!ws;
		this._socketContext = ws?.socket;
		this._maxBackPressure = ws?.maxBackPressure ?? 16 * 1024; // 16kb default


		// The uWS request is stack-allocated and unusable once the handler awaits :
		// everything needed later must be snapshotted right now
		this._method = this._ureq.getMethod();
		this._url = this._ureq.getUrl();
		this._queryString = this._ureq.getQuery() ?? '';
		this._remoteAddress = normalizeIp(Buffer.from(res.getRemoteAddressAsText()).toString());

		// Populate params
		for (let i = 0; i < params.length; i++)
			this._params[params[i].slice(1)] = this._ureq.getParameter(i)!;

		// Populate headers
		this._ureq.forEach((key, value) => this._reqHeaders[key] = value);

		// Start consuming body chunks immediately : uWS drops chunks arriving before onData is attached
		if(!ws && ['post', 'put', 'patch', 'delete'].includes(this._method)){
			if(Number(this._reqHeaders['content-length']) > this._bodyLimit)
				this._bodyTooLarge = true;
			this._bodyRawPromise = this._getBodyRaw(res);
			// Mark a potential abort rejection as handled to avoid unhandledRejection when body is never read
			this._bodyRawPromise.catch(() => {});
		}

		// Bind the abort handler as required by uWebsockets.js for each uWS.HttpResponse to allow for async processing
		// https://github.com/uNetworking/uWebSockets.js/blob/master/examples/AsyncFunction.js
      res.onAborted(() => {
			this._aborted = true;
			this._ended = true;
			this._bodyReject?.(new Error('Request aborted'));
			for (const handler of this._abortHandlers)
				handler();
			this._stopHeartbeat();
			this._finish();
		});
	}


	get mousse(){
		return this._mousse;
	}


// -- OTHER METHODS

	log(data? : any){
		this._logger?.log(data);
	}

	/**
	 * Register a listener called if the client goes away before the response ended,
	 * typically an SSE stream closed by the client : clear timers and subscriptions there.
	 * Called right away when the request is already aborted.
	 * @param listener
	 */
	onAbort(listener : () => void){
		if(this._aborted)
			listener();
		else
			this._abortHandlers.push(listener);
		return this;
	}

	/**
	 * Whether the client went away before the response ended
	 */
	get aborted(){
		return this._aborted;
	}

	/**
	 * Run the onResponse hooks, once. Hooks never break the response : their errors are logged.
	 */
	private _finish(){
		if(this._finished)
			return;
		this._finished = true;

		if(this._responseHooks.length === 0)
			return;

		const info : ResponseInfo = {
			statusCode : this._statusCode,
			elapsedTime : Number(process.hrtime.bigint() - this._startTime) / 1e6,
			aborted : this._aborted
		};

		const report = (e : any) => this._logger ? this._logger.log(e) : console.error(e);
		for(const hook of this._responseHooks){
			try{
				const result = hook(this, info);
				if(result instanceof Promise)
					result.catch(report);
			} catch(e) {
				report(e);
			}
		}
	}

	/**
	 * Throw a PayloadTooLargeError when the declared content-length already exceeds the body limit.
	 * Called by the route pipeline before any middleware.
	 * @internal
	 */
	checkBodyLimit(){
		if(this._bodyTooLarge)
			throw new PayloadTooLargeError(this._bodyLimit);
	}

	/**
	 * Validate params and query against the route schemas, replacing them with the validated
	 * (possibly transformed) values. Called by the route pipeline before any middleware.
	 * @internal
	 */
	async applySchemas(){
		if(!this._schemas)
			return;

		if(this._schemas.Params)
			this._params = await validateSchema(this._schemas.Params, 'params', this._params) as Record<string, string>;

		if(this._schemas.Query)
			this._query = await validateSchema(this._schemas.Query, 'query', this.query) as Record<string, any>;
	}


// -- 🌐 REQUEST METHODS

	get request(){
		return this._ureq;
	}

	get route(){
		return this._route;
	}


	private async _getBodyRaw(res : uHttpResponse): Promise<Buffer>{
		let buffer : Buffer | undefined;
		let received = 0;

		return new Promise((resolve, reject) => {
			this._bodyReject = reject;

			if(this._bodyTooLarge)
				reject(new PayloadTooLargeError(this._bodyLimit));

			res.onData((ab, isLast) => {
				// Over the limit : remaining chunks are dropped, never buffered
				if(this._bodyTooLarge)
					return;

				// content-length may lie or be absent (chunked) : count what really arrives
				received += ab.byteLength;
				if(received > this._bodyLimit){
					this._bodyTooLarge = true;
					buffer = undefined;
					reject(new PayloadTooLargeError(this._bodyLimit));
					return;
				}

				// The ArrayBuffer is only valid during this callback : copy it
				const chunk = Buffer.from(ab.slice(0));

				if (isLast) {
					if (buffer)
						resolve(Buffer.concat([buffer, chunk]));
					else
						resolve(chunk);
				} else {
					if (buffer)
						buffer = Buffer.concat([buffer, chunk]);
					else
						buffer = chunk;
				}
			});
		});
	};

	/**
	 *
	 * @param raw
	 */
	async body(raw : true) : Promise<Buffer | null>;
	async body(raw? : false) : Promise<Types["Body"]>;
	async body(raw? : boolean) : Promise<Types["Body"] | Buffer | null>  {
		if(!raw && this._bodyParsed !== undefined)
			return this._bodyParsed;

		if(raw && this._bodyRaw)
			return this._bodyRaw;

		// No body consumption started : request method has no body
		if(!this._bodyRawPromise)
			return raw ? null : {} as Types["Body"];

		if(!this._bodyRaw)
			this._bodyRaw = await this._bodyRawPromise;

		if(raw)
			return this._bodyRaw;

		let parsed;
		try{
			parsed = await this._bodyParser.parse(this._bodyRaw, this._reqHeaders['content-type'], this._schemas?.Body);
		} catch(e) {
			// A parser failure is the client's fault (malformed json...), unless the parser chose a status itself
			throw e instanceof HTTPError ? e : new BodyParseError(e);
		}

		if(this._schemas?.Body)
			parsed = await validateSchema(this._schemas.Body, 'body', parsed);

		this._bodyParsed = parsed;

		return (this._bodyParsed ?? {}) as Types["Body"];
	}

	/**
	 *
	 * @returns
	 */
	get headers(): { [key: string]: string } {
		return this._reqHeaders;
	}

	/**
	 *
	 * @returns
	 */
	getHeader(key : string) : string | null {
		return this._reqHeaders[key.toLowerCase()] ?? null;
	}

	/**
	 * @returns
	 */
	method() {
		return this._method;
	}

	private get _chain() : string[] {
		if(this._proxyChain)
			return this._proxyChain;

		const chain = [this._remoteAddress];
		const forwarded = this._reqHeaders['x-forwarded-for'];

		// Walk x-forwarded-for from the right while the current hop is a trusted proxy
		if(forwarded){
			const hops = forwarded.split(',').map(hop => hop.trim()).filter(hop => hop.length > 0);
			for(let i = hops.length - 1; i >= 0 && this._mousse.isTrustedProxy(chain[chain.length - 1]); i--)
				chain.push(hops[i]);
		}

		return this._proxyChain = chain;
	}

	/**
	 * Client address : the first x-forwarded-for hop, from the right, not sent by a trusted proxy.
	 * Without trusted proxies, the socket peer address.
	 */
	get ip() : string {
		const chain = this._chain;
		return chain[chain.length - 1];
	}

	/**
	 * Addresses from the client to the socket peer, trusted proxies in between
	 */
	get ips() : string[] {
		return [...this._chain].reverse();
	}

	/**
	 * 'http' or 'https', from x-forwarded-proto when the socket peer is a trusted proxy
	 */
	get protocol() : string {
		const forwarded = this._reqHeaders['x-forwarded-proto'];
		if(forwarded && this._mousse.isTrustedProxy(this._remoteAddress))
			return forwarded.split(',')[0].trim().toLowerCase();

		return this._mousse.ssl ? 'https' : 'http';
	}

	/**
	 * Requested host (with port if any), from x-forwarded-host when the socket peer is a trusted proxy
	 */
	get host() : string {
		const forwarded = this._reqHeaders['x-forwarded-host'];
		if(forwarded && this._mousse.isTrustedProxy(this._remoteAddress))
			return forwarded.split(',')[0].trim();

		return this._reqHeaders['host'] ?? '';
	}

	/**
	 *
	 * @returns
	 */
	get params() : Record<Types["Params"] extends string ? Types["Params"] : string, string> {
		return this._params;
	}

	/**
	 * A declared param (Params schema or generics) is guaranteed by the route match :
	 * only untyped routes get string | undefined.
	 * @param key
	 * @returns
	 */
	param(key: Types["Params"] extends string ? Types["Params"] : string) : string extends Types["Params"] ? string | undefined : string {
		return this._params[key] as any;
	}


	/**
	 */
	get query(): Types["Query"] extends object ? Types["Query"] : { [key: string]: any } {
		if (!this._query)
			this._query = this._queryString ? parseQueryString(this._queryString) : {};

		return this._query;
	}

	/**
	 */
	get url() {
		return this._url;
	}


	contentType() {
		return this._reqHeaders['content-type'] ?? '';
	}





// -- 🌐 RESPONSE METHODS

	get response(){
		return this._ures;
	}

	/**
	 * 
	 * @param code 
	 * @param message 
	 * @returns 
	 */
	status(code: number, message? : string) {
		this._statusCode = code;
		this._statusMessage = message;

		return this;
	}

	/**
	 */
	get statusCode(){
		return this._statusCode;
	}

	/**
	 * Set the response content type header based on the provided mime type. Example: type('json')
	 * @param filenameOrExt file extension or mime types
	 * @returns
	 */
	type(filenameOrExt : string) {
		if (filenameOrExt[0] === '.')
			filenameOrExt = filenameOrExt.substring(1);

		this.header('content-type', mime_types.contentType(filenameOrExt) || 'text/plain');
		return this;
	}

	/**
	 * Either set header using string or object. Replaces any previous value ;
	 * an array value is written as one header line per entry.
	 * @param field
	 * @param value
	 */
	header(name : string, value : string | string[]) : Context<Types>;
	header(field : Record<string, any>) : Context<Types>;
	header(field : Record<string, any> | string, value? : string | string[]) : Context<Types> {
		if(typeof field === 'object') {
			for(const header in field)
				this.header(header, field[header]);
			return this;
		}

		if(typeof field === 'string' && value === undefined)
			throw new Error('Header value is required');

      this._headers[field.toLowerCase()] = value!;

		return this;
	}

	/**
	 * Add a value to a response header without replacing the previous ones,
	 * written as separate header lines (required for set-cookie)
	 * @param name
	 * @param value
	 */
	appendHeader(name : string, value : string | string[]) {
		const key = name.toLowerCase();
		const previous = this._headers[key];
		const values = Array.isArray(value) ? value : [value];

		if(previous === undefined)
			this._headers[key] = Array.isArray(value) ? [...value] : value;
		else
			this._headers[key] = [...(Array.isArray(previous) ? previous : [previous]), ...values];

		return this;
	}

	/**
	 * Write status line and headers. Must run inside a cork.
	 */
	private _writeHead() {
		this._ures.writeStatus(this._statusCode + ' ' + (this._statusMessage || STATUS_CODES[this._statusCode] || ''));

		for (const name in this._headers) {
			const value = this._headers[name];
			if (Array.isArray(value))
				for (const v of value)
					this._ures.writeHeader(name, v);
			else
				this._ures.writeHeader(name, value);
		}
	}


	/**
	 * This method is used to end the current response and respond with specified body and headers.
	 * All writes actions are corked as required by uWebsocket.js specifications
	 ** NOTE Streamable case not handled for now
	 * @param body
	 * @returns
	 */
   respond(body? : string | Buffer | ArrayBuffer) {

		// Check if the response has already been sent
		if(this._ended)
			return this;

		// Check if has been upgraded
		if(this._upgraded)
			return this;

		// Status and headers are already sent : responding ends the event stream
		if(this._sustained){
			this._stopHeartbeat();
			this._ures.cork(() => this._ures.end(body));
			this._ended = true;
			this._finish();
			return this;
		}

		this._ures.cork(() => {
			this._writeHead();

			// Need to send a response without a body with the custom content-length header
			if(body === undefined && !!this._headers['content-length']){
				const contentLength = this._headers['content-length'];
				const reportedContentLength : number = parseInt(Array.isArray(contentLength) ? contentLength[contentLength.length - 1] : contentLength);
				this._ures.endWithoutBody(reportedContentLength);
			}
			else
				this._ures.end(body);
		});

		this._ended = true;
		this._upgradable = false;
		this._sustainable = false;

		this._finish();

      return this;
   }

	/**
	 *
	 * @returns
	 */
	get ended(){
		return this._ended;
	}


	/**
	 * This method is used to redirect an incoming request to a different url.
	 * @param url
	 * @returns
	 */
	redirect(url : string) {
		if (!this._ended)
			return this.status(302).header('location', url).respond();
		return this;
	}


	/**
	 * respond() alias setting application/json content type and sends provided json object
	 * @param body
	 * @param status
	 * @returns
	 */
   json(body : Types["Response"] | ErrorResponseOf<Types>, status? : {code : number, message? : string}) {
		if(this._upgraded)
			return this;

		if(status)
			this.status(status.code, status.message);

		// The schema is picked from the final status : exact code, then range
		const schema = responseSchemaFor(this._schemas?.Response, this._statusCode);

		// Response schema validation is synchronous by design : serialization cannot await
		if(schema)
			body = validateSchemaSync(schema, 'response', body) as Types["Response"];

		const compiled = schema ? this._compiledSerializers?.get(schema) : undefined;
		const payload = compiled ? compiled(body) : this._responseSerializer.serialize(body, schema);

		return this.header('content-type', 'application/json').respond(payload);
   }


	/**
	 * respond() alias setting text/html content type and sends provided html
	 * @param body
	 * @returns
	 */
	html(body : string, status? : {code : number, message? : string}) {
		if(this._upgraded)
			return this;

		if(status)
			this.status(status.code, status.message);

		return this.header('content-type', 'text/html').respond(body);
	}


	/**
	 * Stream a file with its content type. Missing file (or not a regular file) -> 404, other errors -> 500.
	 * Backpressure is handled : the read stream is paused until the socket is writable again.
	 * The path is used as-is : never build it from unsanitized request data.
	 * @param path
	 */
	async file(path: string) {
		if(this._upgraded || this._ended)
			return;

		let size : number;
		try {
			const stats = await stat(path);
			if(!stats.isFile())
				throw Object.assign(new Error('Not a file'), {code : 'ENOENT'});
			size = stats.size;
		} catch (e : any) {
			if(e?.code === 'ENOENT' || e?.code === 'ENOTDIR')
				this.status(404).respond('Not found');
			else {
				this._logger ? this._logger.log(e) : console.error(e);
				this.status(500).respond();
			}
			return;
		}

		// Aborted while stating
		if(this._ended)
			return;

		this.type(path.toLowerCase());

		if(size === 0){
			this.respond('');
			return;
		}

		// From here on the response is owned by the stream
		this._ended = true;
		this._upgradable = false;
		this._sustainable = false;

		await new Promise<void>((resolve) => {
			const stream = createReadStream(path);
			let headWritten = false;

			const finish = () => {
				stream.destroy();
				this._finish();
				resolve();
			};
			this._abortHandlers.push(finish);

			stream.on('error', (e) => {
				this._logger ? this._logger.log(e) : console.error(e);
				if(!this._aborted)
					this._ures.cork(() => {
						// Headers not sent yet : a proper 500 is still possible, otherwise cut the connection
						if(!headWritten){
							this._statusCode = 500;
							this._statusMessage = undefined;
							this._headers = {};
							this._writeHead();
							this._ures.end();
						}
						else
							this._ures.close();
					});
				finish();
			});

			stream.on('data', (chunk) => {
				if(this._aborted)
					return finish();

				const buffer = chunk as Buffer;
				// tryEnd needs an ArrayBuffer holding exactly this chunk
				const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

				let ok = false, done = false, offset = 0;
				this._ures.cork(() => {
					if(!headWritten){
						this._writeHead();
						headWritten = true;
					}
					offset = this._ures.getWriteOffset();
					[ok, done] = this._ures.tryEnd(ab, size);
				});

				if(done)
					return finish();

				if(!ok){
					// Socket full : wait for drain, then send the remaining part of this chunk
					stream.pause();
					this._ures.onWritable((writeOffset) => {
						const [ok, done] = this._ures.tryEnd(ab.slice(writeOffset - offset), size);
						if(done)
							finish();
						else if(ok)
							stream.resume();
						return ok;
					});
				}
			});
		});
	}




//// *
// * SSE METHODS
//// *

	get sustained(){
		return this._sustained;
	}

	/**
	 * Open the event stream : status and headers (middleware ones included) are sent right away.
	 * End it from the server with respond().
	 * @param options
	 */
	sustain(options? : SustainOptions){
		if(this._ended || !this._sustainable)
			throw new Error('Context is not sustainable');
		if(this._sustained)
			return;

		this._headers['content-type'] = 'text/event-stream';
		this._headers['connection'] = 'keep-alive';
		this._headers['cache-control'] = 'no-cache';
		// Disable nginx response buffering, which would hold events back
		this._headers['x-accel-buffering'] ??= 'no';

		this._ures.cork(() => this._writeHead());

		this._sustained = true;
		this._upgradable = false;

		if(options?.heartbeat)
			this._heartbeat = setInterval(() => this.ping(), options.heartbeat);
	}

	private _stopHeartbeat(){
		if(this._heartbeat)
			clearInterval(this._heartbeat);
		this._heartbeat = undefined;
	}

	private flushEventQueue() {
		if (this._isDraining)
			return;

		this._isDraining = true;

		let wrote = true;
		this._ures.cork(() => {
			while (wrote && this._eventQueue.length > 0) {
				wrote = this._ures.write(this._eventQueue.shift()!);
			}
		});

		if (!wrote) {
			this._ures.onWritable(() => {
				let wrote = true;
				while (wrote && this._eventQueue.length > 0) {
					wrote = this._ures.write(this._eventQueue.shift()!);
				}

				if (this._eventQueue.length === 0 || wrote) {
					this._isDraining = false;
					return false; // stop calling onWritable
				}

				return true; // keep trying
			});
		} else {
			this._isDraining = false;
		}
	}

	/**
	 * Send an event. Objects are JSON serialized, multi-line strings are split into several data lines.
	 * @param data
	 * @param options event, id and retry fields
	 */
	send(data : string | object, options? : SSEEventOptions){
		if(this._ended || !this._sustained)
			throw new Error('Context is not sustained');

		// Line breaks in event / id would forge extra fields
		const field = (value : string | number) => String(value).replace(/[\r\n\0]/g, '');

		let frame = '';
		if(options?.event !== undefined)
			frame += `event: ${field(options.event)}\n`;
		if(options?.id !== undefined)
			frame += `id: ${field(options.id)}\n`;
		if(options?.retry !== undefined)
			frame += `retry: ${Math.floor(options.retry)}\n`;

		const payload = typeof data === "string" ? data : JSON.stringify(data);
		for(const line of payload.split(/\r\n|\r|\n/))
			frame += `data: ${line}\n`;

		this._eventQueue.push(frame + '\n');
		this.flushEventQueue();
	}

	/**
	 * Send a comment frame, ignored by clients : keeps idle streams alive through proxies
	 */
	ping(){
		if(this._ended || !this._sustained)
			return;

		this._eventQueue.push(':\n\n');
		this.flushEventQueue();
	}


//// *
// * WEBSOCKET METHODS
//// *

	get upgradable(){
		return this._upgradable;
	}

	get upgraded(){
		return this._upgraded;
	}

	get wsEventHandlers(){
		return this._wsEventHandlers;
	}

	on<Event extends keyof WebSocketEventHandlers>(type: Event, listener: WebSocketEventHandlers[Event]){
		this._wsEventHandlers[type] = listener;
	}

	off<Event extends keyof WebSocketEventHandlers>(type : Event){
		delete this._wsEventHandlers[type];
	}

	onMessage(listener : WebSocketEventHandlers["message"]){ this._wsEventHandlers["message"] = listener; }
	onClose(listener : WebSocketEventHandlers["close"]){ this._wsEventHandlers["close"] = listener; };
	onDrain(listener : WebSocketEventHandlers["drain"]){ this._wsEventHandlers["drain"] = listener; }
	onDropped(listener : WebSocketEventHandlers["dropped"]){ this._wsEventHandlers["dropped"] = listener; }
	onOpen(listener : WebSocketEventHandlers["open"]){ this._wsEventHandlers["open"] = listener; }
	onPing(listener : WebSocketEventHandlers["ping"]){ this._wsEventHandlers["ping"] = listener; }
	onPong(listener : WebSocketEventHandlers["pong"]){ this._wsEventHandlers["pong"] = listener; }
	onSubscription(listener : WebSocketEventHandlers["subscription"]){ this._wsEventHandlers["subscription"] = listener; }

	upgrade(){
		if(this._ended || !this._upgradable || !this._socketContext)
			throw new Error('Current context cannot be upgraded');

		if(this._upgraded)
			return;

		this._upgraded = true;
		this._statusCode = 101;
		// Headers come from the snapshot : the uWS request is not usable anymore if an await occurred
		this._ures.upgrade({
			handlers : this._wsEventHandlers,
			bufferQueue : [],
			maxBackPressure : this._maxBackPressure,
			snapshot : {
				params : this._params,
				query : this.query,
				headers : this._reqHeaders,
				url : this._url,
				route : this._route,
				ip : this.ip
			}
		},
			this._reqHeaders['sec-websocket-key'] ?? '',
			this._reqHeaders['sec-websocket-protocol'] ?? '',
			this._reqHeaders['sec-websocket-extensions'] ?? '',
			this._socketContext
		);

		this._finish();
	}

}


/**
 * Context handed to a ws route handler : the connection is already established.
 * Wraps the native socket with backpressure-safe send, pub/sub helpers, event
 * registration, and the request data snapshotted at upgrade time.
 */
export class WSContext<Types extends ContextTypes = DefaultContextTypes>{

	private _ws : WebSocket;

	private _mousse : Mousse;

	private _logger? : Logger;

	constructor(ws : WebSocket, mousse : Mousse, logger? : Logger){
		this._ws = ws;
		this._mousse = mousse;
		this._logger = logger;
	}

	private get _userData(){
		return this._ws.getUserData();
	}


// -- OTHER METHODS

	log(data? : any){
		this._logger?.log(data);
	}

	// The mousse instance : c.mousse.publish() broadcasts app-wide (all ws routes)
	get mousse(){
		return this._mousse;
	}

	// The underlying uWS socket, for advanced use
	get socket(){
		return this._ws;
	}


// -- 🌐 ORIGINAL REQUEST DATA (snapshotted at upgrade time)

	get params() : Record<Types["Params"] extends string ? Types["Params"] : string, string> {
		return this._userData.snapshot.params;
	}

	param(key: Types["Params"] extends string ? Types["Params"] : string) : string extends Types["Params"] ? string | undefined : string {
		return this._userData.snapshot.params[key] as any;
	}

	get query() : Types["Query"] extends object ? Types["Query"] : { [key: string]: any } {
		return this._userData.snapshot.query;
	}

	get headers() : { [key: string]: string } {
		return this._userData.snapshot.headers;
	}

	getHeader(key : string) : string | null {
		return this._userData.snapshot.headers[key.toLowerCase()] ?? null;
	}

	get url(){
		return this._userData.snapshot.url;
	}

	get route(){
		return this._userData.snapshot.route;
	}

	// Client address resolved at upgrade time (trustProxy aware)
	get ip(){
		return this._userData.snapshot.ip;
	}


// -- ⚡ SOCKET METHODS

	/**
	 * Send a message through the socket. Backpressure is handled : messages exceeding
	 * the route maxBackPressure are queued and flushed in order on drain.
	 */
	send(message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this._ws.send(message, isBinary, compress);
	}

	subscribe(topic : RecognizedString){
		return this._ws.subscribe(topic);
	}

	unsubscribe(topic : RecognizedString){
		return this._ws.unsubscribe(topic);
	}

	/**
	 * Publish to sockets of THIS route subscribed to the topic, excluding the sender.
	 * uWS scopes its topic tree per ws route : to reach subscribers across all routes
	 * (or include the sender), use c.mousse.publish() instead.
	 */
	publish(topic : RecognizedString, message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this._ws.publish(topic, message, isBinary, compress);
	}

	/**
	 * Gracefully close the connection with an optional code and message
	 */
	end(code? : number, shortMessage? : RecognizedString){
		this._ws.end(code, shortMessage);
	}


// -- ⚡ EVENT REGISTRATION

	on<Event extends keyof WebSocketEventHandlers>(type: Event, listener: WebSocketEventHandlers[Event]){
		this._userData.handlers[type] = listener;
	}

	off<Event extends keyof WebSocketEventHandlers>(type : Event){
		delete this._userData.handlers[type];
	}

	onMessage(listener : WebSocketEventHandlers["message"]){ this._userData.handlers["message"] = listener; }
	onClose(listener : WebSocketEventHandlers["close"]){ this._userData.handlers["close"] = listener; }
	onDrain(listener : WebSocketEventHandlers["drain"]){ this._userData.handlers["drain"] = listener; }
	onDropped(listener : WebSocketEventHandlers["dropped"]){ this._userData.handlers["dropped"] = listener; }
	onPing(listener : WebSocketEventHandlers["ping"]){ this._userData.handlers["ping"] = listener; }
	onPong(listener : WebSocketEventHandlers["pong"]){ this._userData.handlers["pong"] = listener; }
	onSubscription(listener : WebSocketEventHandlers["subscription"]){ this._userData.handlers["subscription"] = listener; }
}

