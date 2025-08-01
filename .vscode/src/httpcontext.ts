import { getParts, RecognizedString, HttpRequest as uHttpRequest, HttpResponse as uHttpResponse, WebSocket, us_socket_context_t as uWSSocketContext } from 'uWebSockets.js';
import { readFile } from 'fs/promises';
import mime_types from "mime-types";
import {STATUS_CODES} from 'http'
import { Mousse } from './mousse';
import { parseQuery } from './utils';

export type ActiveHTTPContextHandler<Types extends HTTPContextTypes> = (context: HTTPContext<Types["Body"]>) => void | Promise<void> | Types["Response"] | Promise<Types["Response"]>;
export type PassiveHTTPContextHandler<Types extends HTTPContextTypes> = (context: HTTPContext<Types["Body"]>) => void | Promise<void>;



export type HTTPContextTypes = {
	Body? : any;
	Response? : any;
}

export class HTTPContext<Types extends HTTPContextTypes = {Body : any, Response : any}>{

	ureq : uHttpRequest;

	ures : uHttpResponse;

	// The route pattern 
	route : string;

	// The mousse instance that has created the context
	mousse : Mousse;

	private _bodyParsed: { [key: string]: any } | null = null;
	
	private _bodyRaw: Buffer | null = null;

	private _params: Record<string, string> = {};

	private _reqHeaders : Record<string, string> = {};

	private _headers : Record<string, string> = {};

   /**
     * Returns the custom HTTP underlying status code of the response.
	*/
	private _statusCode : number = 200;
	
   /**
     * Returns the custom HTTP underlying status code message of the response.
   */
   private _statusMessage? : string = undefined;

	/**
		Flag if response has been sent
	*/
	private _ended : boolean = false;


	/**
		Flag used for send to know if an error has been thrown
	*/
	// _thrown : boolean = false;

	constructor(req : uHttpRequest, res : uHttpResponse, route : string, params : string[], mousse : Mousse) {
		this.ureq = req;
		this.ures = res;
		this.route = route;
		this.mousse = mousse;

		// Populate params
		for (let i = 0; i < params.length; i++)
			this._params[params[i].slice(1).toLowerCase()] = this.ureq.getParameter(i)!;

		// Populate headers
		this.ureq.forEach((key, value) => this._reqHeaders[key] = value);
		
		// Bind the abort handler as required by uWebsockets.js for each uWS.HttpResponse to allow for async processing
		// https://github.com/uNetworking/uWebSockets.js/blob/master/examples/AsyncFunction.js
      res.onAborted(() => {
			if (this._ended) 
				return;
			this._ended = true;
		});
		

		// ? Need to check if request has been paused or has not been fully received (see hyper express)
	}


//// *
// * REQUEST METHODS
//// *

	/**
	 * Gather all body data
	 * @param res 
	 * @returns 
	 */
	private async _getBodyRaw(res: uHttpResponse): Promise<Buffer> {
		let buffer: Buffer;

		return new Promise(resolve => res.onData(
			(ab, isLast) => {
				const chunk = Buffer.from(ab);

				if (isLast) {
					if (buffer) 
						resolve(Buffer.concat([buffer, chunk]));
					else 
						resolve(chunk);
				} else {
					if (buffer) 
						buffer = Buffer.concat([buffer, chunk]);
					else 
						buffer = Buffer.concat([chunk]);
				}
			}
		));
	}

	/**
	 * Parse body based on contentType
	 * @param body 
	 * @returns 
	 */
	private _parseBodyRaw(contentType : string, body? : Buffer<ArrayBufferLike>){
		if(!body?.length)
			return {};

		if(contentType === 'application/json'){
			const bodyStr = body.toString();
			return bodyStr ? JSON.parse(bodyStr) : {};
		}

		if(contentType === 'application/x-www-form-urlencoded'){
			const bodyStr = body.toString();
			return bodyStr ? parseQuery(bodyStr) : {};
		}

		if (contentType.startsWith('multipart/form-data')) {
			const multiparts = getParts(body, contentType);
			if(!multiparts) 
				return {};
			
			const data: Record<string, string> = {};
			for(const p of multiparts){
				if (!p.type && !p.filename) 
					data[p.name] = Buffer.from(p.data).toString();
			}

			return data;
		}

		return body;
	}

	//
	async body(raw : true) : Promise<Buffer>;
	async body(raw? : false) : Promise<Types["Body"]>;
	async body(raw? : boolean) : Promise<Types["Body"] | Buffer>  {
		const contentType = this.ureq.getHeader('content-type');

		// ? Should send an error ?
		if (!contentType)
			return {} as Types["Body"];

		if(this._bodyParsed && !raw)
			return this._bodyParsed as Types["Body"];

		if(this._bodyRaw && raw)
			return this._bodyRaw;

		this._bodyRaw = await this._getBodyRaw(this.ures);
		this._bodyParsed = this._parseBodyRaw(contentType);
		
		return raw ? this._bodyRaw : (this._bodyParsed ?? {}) as Types["Body"];
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
		return this.ureq.getHeader(key.toLowerCase());
	}


	/**
	 * 
	 * @returns 
	 */
	method() {
		return this.ureq.getMethod();
	}


	/**
	 * 
	 * @returns 
	 */
	get params() : Record<string, string> {
		return this._params;
	}

	param(key: string) : string | undefined {
		return Object.keys(this._params).includes(key.toLowerCase()) ? this._params[key.toLowerCase()] : undefined;
	}


	get query(): { [key: string]: any } {
		const query = this.ureq.getQuery();

		if (query) 
			return parseQuery(query);

		return {};
	}


	get url() {
		return this.ureq.getUrl();
	}


	contentType() {
		return this.ureq.getHeader('content-type');
	}


//// *
// * RESPONSE METHOD
//// *


	status(code: number, message? : string) {
		this._statusCode = code;
		this._statusMessage = message;

		return this;
	}


	get statusCode(){
		return this._statusCode;
	}

	/**
	* 
	*/
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
	header(name : string, value : string);
	header(field : Record<string, any>);
	header(field : Record<string, any> | string, value? : string) {
		if(typeof field === 'object') {
			for(const header in field)
				this.header(header, field[header]);
			return this;
		}

		if(typeof field === 'string' && !value)
			throw new Error('Header value is required');
		
      this._headers[field.toLowerCase()] = value!;

		return this;
	}


	/**
	 * This method is used to end the current request and send response with specified body and headers.
	 * All writes actions are corked as required by uWebsocket.js specifications
	 ** NOTE Streamable case not handled for now
	 * @param body 
	 * @returns 
	 */
   send(body? : string | Buffer | ArrayBuffer) {
		
		// Check if the response has already been sent
		if(this._ended)
			return this;

		this.ures.cork(() => {
			// Write status code along with mapped status code message
			if (this._statusCode || this._statusMessage)
				this.ures.writeStatus((this._statusCode ?? 200) + ' ' + (this._statusMessage || STATUS_CODES[this._statusCode ?? 200]));
			else
				this.ures.writeStatus("200 " + STATUS_CODES[200]);

			// Write headers
			for (const name in this._headers) {
				this.ures.writeHeader(name, Array.isArray(this._headers[name]) ? this._headers[name].join(', ') : this._headers[name]); 
			}

			// Need to send a response without a body with the custom content-length header
			if(body === undefined && !!this._headers['content-length']){
				const contentLength : string | string[] = this._headers['content-length'];
				const reportedContentLength : number = parseInt(Array.isArray(contentLength) ? contentLength[contentLength.length - 1] : contentLength);
				this.ures.endWithoutBody(reportedContentLength);
			}
			else
				this.ures.end(body);
		});

		this._ended = true;

      return this;
   }

	/**
	 * 
	 * @returns 
	 */
	sent(){
		return this._ended;
	}


	/**
	 * This method is used to redirect an incoming request to a different url.
	 * @param url 
	 * @returns 
	 */
	redirect(url : string) {
		if (!this._ended) 
			return this.status(302).header('location', url).send();
		return this;
	}


	/**
	 * send() alias setting application/json content type and sends provided json object
	 * @param body 
	 * @param status
	 * @returns 
	 */
   json(body : Types["Body"], status? : {code : number, message? : string}) {
		if(status)
			this.status(status.code, status.message);

		return this.header('content-type', 'application/json').send(JSON.stringify(body));
   }


	/**
	 * send() alias setting text/html content type and sends provided html
	 * @param body 
	 * @returns 
	 */
	html(body : string, status? : {code : number, message? : string}) {
		if(status)
			this.status(status.code, status.message);

		return this.header('content-type', 'text/html').send(body);
	}


	async file(path: string) {
		try {
			const file = await readFile(path);

			this.type(path.toLowerCase()).send(file as any);
		} catch (e) {
			this.status(404).send('Not found');
		}
	}
}