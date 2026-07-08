import { RecognizedString, HttpRequest as uHttpRequest, HttpResponse as uHttpResponse, us_socket_context_t as uWSSocketContext, WebSocket as uWSWebSocket } from 'uWebSockets.js';
import { readFile } from 'fs/promises';
import mime_types from "mime-types";
import {STATUS_CODES} from 'http'
import type { Mousse } from './mousse.js';
import { parseQueryString } from './utils.js';
import { BodyParser } from './module/bodyparser.js';
import { ResponseSerializer } from './module/responseserializer.js';
import { Logger } from './module/logger.js';
import { HTTPRouteMethod } from './route.js';
import { Schemas, validateSchema, validateSchemaSync } from './module/schema.js';

/**
 * Enhanced websocket
 */
export type WebSocket = uWSWebSocket<{handlers : Partial<WebSocketEventHandlers>, maxBackPressure : number, bufferQueue : RecognizedString[]}>;

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
	Query? : any;
	Params? : string;
}

export type DefaultContextTypes = {Body : any, Response : any};

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

export interface SustainableContext{
	sustain : () => void;
	sustained : boolean;
	send : (data : string | object) => void;
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

	//
	private _schemas? : Schemas;


	private _bodyParser : BodyParser<any>;

	private _responseSerializer : ResponseSerializer<any>;


	// Populated param
	private _params: Record<string, string> = {};

	// Parsed (and possibly schema validated) query, cached
	private _query? : Record<string, any>;

	// Request headers
	private _reqHeaders : Record<string, string> = {};



// 🌐 -- Response related attributes

	// uWebSocket.js response
	private _ures : uHttpResponse;

	// Response headers
	private _headers : Record<string, string> = {};

   // Returns the custom HTTP underlying status code of the response.
	private _statusCode : number = 200;

   // Returns the custom HTTP underlying status code message of the response.
   private _statusMessage? : string = undefined;

	// Flag if response has been sent
	private _ended : boolean = false;



// -- SSE related attributes


	private _sustainable : boolean = false;

	private _sustained : boolean = false;

	private _eventQueue : string[] = [];

	private _isDraining : boolean = false;



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
		http? : {method? : HTTPRouteMethod, schemas? : Schemas},
		ws? : {socket? : uWSSocketContext, maxBackPressure? : number}
	) {
		this._mousse = mousse;

		this._ureq = req;
		this._ures = res;
		this._route = route;

		this._bodyParser = bodyParser;
		this._responseSerializer = responseSerializer;
		this._logger = logger;

		this._schemas = http?.schemas;
		this._sustainable = !!http?.method && (['get', 'patch', 'post', 'put'] as HTTPRouteMethod[]).includes(http?.method);

		this._upgradable = !!ws;
		this._socketContext = ws?.socket;
		this._maxBackPressure = ws?.maxBackPressure ?? 16 * 1024; // 16kb default


		// The uWS request is stack-allocated and unusable once the handler awaits :
		// everything needed later must be snapshotted right now
		this._method = this._ureq.getMethod();
		this._url = this._ureq.getUrl();
		this._queryString = this._ureq.getQuery() ?? '';

		// Populate params
		for (let i = 0; i < params.length; i++)
			this._params[params[i].slice(1).toLowerCase()] = this._ureq.getParameter(i)!;

		// Populate headers
		this._ureq.forEach((key, value) => this._reqHeaders[key] = value);

		// Start consuming body chunks immediately : uWS drops chunks arriving before onData is attached
		if(!ws && ['post', 'put', 'patch', 'delete'].includes(this._method)){
			this._bodyRawPromise = this._getBodyRaw(res);
			// Mark a potential abort rejection as handled to avoid unhandledRejection when body is never read
			this._bodyRawPromise.catch(() => {});
		}

		// Bind the abort handler as required by uWebsockets.js for each uWS.HttpResponse to allow for async processing
		// https://github.com/uNetworking/uWebSockets.js/blob/master/examples/AsyncFunction.js
      res.onAborted(() => {
			if (this._ended)
				return;
			this._ended = true;
			this._bodyReject?.(new Error('Request aborted'));
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
		let buffer : Buffer;

		return new Promise((resolve, reject) => {
			this._bodyReject = reject;

			res.onData((ab, isLast) => {
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

		let parsed = await this._bodyParser.parse(this._bodyRaw, this._reqHeaders['content-type'], this._schemas?.Body);

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

	/**
	 *
	 * @returns
	 */
	get params() : Record<Types["Params"] extends string ? Types["Params"] : string, string> {
		return this._params;
	}

	/**
	 *
	 * @param key
	 * @returns
	 */
	param(key: Types["Params"] extends string ? Types["Params"] : string) : string | undefined {
		return this._params[key.toLowerCase()];
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
	 * Either set header using string or object
	 * @param field
	 * @param value
	 */
	header(name : string, value : string) : Context<Types>;
	header(field : Record<string, any>) : Context<Types>;
	header(field : Record<string, any> | string, value? : string) : Context<Types> {
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

		this._ures.cork(() => {
			// Write status code along with mapped status code message
			if (this._statusCode || this._statusMessage)
				this._ures.writeStatus((this._statusCode ?? 200) + ' ' + (this._statusMessage || STATUS_CODES[this._statusCode ?? 200]));
			else
				this._ures.writeStatus("200 " + STATUS_CODES[200]);

			// Write headers
			for (const name in this._headers) {
				this._ures.writeHeader(name, Array.isArray(this._headers[name]) ? this._headers[name].join(', ') : this._headers[name]);
			}

			// Need to send a response without a body with the custom content-length header
			if(body === undefined && !!this._headers['content-length']){
				const contentLength : string | string[] = this._headers['content-length'];
				const reportedContentLength : number = parseInt(Array.isArray(contentLength) ? contentLength[contentLength.length - 1] : contentLength);
				this._ures.endWithoutBody(reportedContentLength);
			}
			else
				this._ures.end(body);
		});

		this._ended = true;
		this._upgradable = false;
		this._sustainable = false;

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
   json(body : Types["Response"], status? : {code : number, message? : string}) {
		if(this._upgraded)
			return this;

		if(status)
			this.status(status.code, status.message);

		// Response schema validation is synchronous by design : serialization cannot await
		if(this._schemas?.Response)
			body = validateSchemaSync(this._schemas.Response, 'response', body) as Types["Response"];

		return this.header('content-type', 'application/json').respond(this._responseSerializer.serialize(body, this._schemas?.Response));
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


	async file(path: string) {
		if(this._upgraded)
			return;

		try {
			const file = await readFile(path);

			this.type(path.toLowerCase()).respond(file as any);
		} catch (e) {
			this.status(404).respond('Not found');
		}
	}




//// *
// * SSE METHODS
//// *

	get sustained(){
		return this._sustained;
	}

	sustain(){
		if(this._ended || !this._sustainable)
			throw new Error('Context is not sustainable');
		if(this._sustained)
			return;

		this._ures.cork(() => {
			this._ures.writeHeader('content-type', 'text/event-stream');
			this._ures.writeHeader('connection', 'keep-alive');
			this._ures.writeHeader('cache-control', 'no-cache');
		});

		this._sustained = true;
	}

	private flushEventQueue() {
		if (this._isDraining)
			return;

		this._isDraining = true;

		let wrote = true;
		this._ures.cork(() => {
			while (wrote && this._eventQueue.length > 0) {
				const message = this._eventQueue.shift()!;
				wrote = this._ures.write(`data: ${message}\n\n`);
			}
		});

		if (!wrote) {
			this._ures.onWritable(() => {
				let wrote = true;
				while (wrote && this._eventQueue.length > 0) {
					const message = this._eventQueue.shift()!;
					wrote = this._ures.write(`data: ${message}\n\n`);
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

	send(data : string | object){
		if(this._ended || !this._sustained)
			throw new Error('Context is not sustained');

		this._eventQueue.push(typeof data === "string" ? data : JSON.stringify(data));
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
		// Headers come from the snapshot : the uWS request is not usable anymore if an await occurred
		this._ures.upgrade({
			handlers : this._wsEventHandlers,
			bufferQueue : [],
			maxBackPressure : this._maxBackPressure
		},
			this._reqHeaders['sec-websocket-key'] ?? '',
			this._reqHeaders['sec-websocket-protocol'] ?? '',
			this._reqHeaders['sec-websocket-extensions'] ?? '',
			this._socketContext
		);
	}

}

