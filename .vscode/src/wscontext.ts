import { RecognizedString, HttpRequest as uHttpRequest, HttpResponse as uHttpResponse, WebSocket, us_socket_context_t as uWSSocketContext } from 'uWebSockets.js';
import { Mousse } from './mousse';
import { parseQuery } from './utils';


/**
 * Websocket listenable event keys and their handler type
 */
export type WSContextEventHandlers = {
	'message' : (message : ArrayBuffer, isBinary? : boolean) => void | Promise<void>;
	'close' : (code: number, message: ArrayBuffer) => void;
	'drain' : () => void;
	'dropped' : (message : ArrayBuffer, isBinary? : boolean) => void | Promise<void>;
	'open' : () => void | Promise<void>;
	'ping' : (message : ArrayBuffer) => void | Promise<void>;
	'pong' : (message : ArrayBuffer) => void | Promise<void>;
	'subscription' : (topic: ArrayBuffer, newCount: number, oldCount: number) => void;
};


export class WSContext<UserData extends any>{

	ureq : uHttpRequest;

	ures : uHttpResponse;

	// The route pattern 
	route : string;

	// The mousse instance that has created the context
	mousse : Mousse;

	ws : WebSocket<UserData>;

	private _upgraded : boolean = false;

	private _socketContext : uWSSocketContext;

	private _params: Record<string, string> = {};

	private _reqHeaders : Record<string, string> = {};

	private _eventHandlers : Partial<WSContextEventHandlers> = {};
	


	/**
		Flag used for send to know if an error has been thrown
	*/
	// _thrown : boolean = false;

	constructor(req : uHttpRequest, res : uHttpResponse, route : string, params : string[], mousse : Mousse, socketContext : uWSSocketContext) {
		this.ureq = req;
		this.ures = res;
		this.route = route;
		this.mousse = mousse;
		this._socketContext = socketContext;

		// Populate params
		for (let i = 0; i < params.length; i++)
			this._params[params[i].slice(1).toLowerCase()] = this.ureq.getParameter(i)!;

		// Populate headers
		this.ureq.forEach((key, value) => this._reqHeaders[key] = value);
	}


//// *
// * REQUEST METHODS
//// *


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
// * WEBSOCKET METHOD
//// *

	on<Event extends keyof WSContextEventHandlers>(type: Event, listener: WSContextEventHandlers[Event]){
		this._eventHandlers[type] = listener;
	}

	off<Event extends keyof WSContextEventHandlers>(type : Event){
		delete this._eventHandlers[type];
	}

	onMessage(listener : WSContextEventHandlers["message"]){ this._eventHandlers["message"] = listener; }
	onClose(listener : WSContextEventHandlers["close"]){ this._eventHandlers["close"] = listener; };
	onDrain(listener : WSContextEventHandlers["drain"]){ this._eventHandlers["drain"] = listener; }
	onDropped(listener : WSContextEventHandlers["dropped"]){ this._eventHandlers["dropped"] = listener; }
	onOpen(listener : WSContextEventHandlers["open"]){ this._eventHandlers["open"] = listener; }
	onPing(listener : WSContextEventHandlers["ping"]){ this._eventHandlers["ping"] = listener; }
	onPong(listener : WSContextEventHandlers["pong"]){ this._eventHandlers["pong"] = listener; }
	onSubscription(listener : WSContextEventHandlers["subscription"]){ this._eventHandlers["subscription"] = listener; }


	upgrade(data? : UserData){
		if(this._upgraded)
			return;

		this._upgraded = true;
		this.ures.upgrade(data,
			/* Spell these correctly */
			this.ureq.getHeader('sec-websocket-key'),
			this.ureq.getHeader('sec-websocket-protocol'),
			this.ureq.getHeader('sec-websocket-extensions'),
			this._socketContext
		);
	}

	get data(){
		return this.ws.getUserData();
	}
	get bufferedAmount(){
		return this.ws.getBufferedAmount();
	};
	
	get remoteAddress(){
		return this.ws.getRemoteAddress();
	};

	get remoteAddressAsText(){
		return this.ws.getRemoteAddressAsText();
	};

   get topics(){
		return this.ws.getTopics();
	}

   isSubscribed(topic : string){
		return this.ws.isSubscribed(topic);
	};

   ping(message : RecognizedString){
		return this.ws.ping(message);
	};

	publish(topic : string, message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this.ws.publish(topic, message, isBinary, compress);
	};

   send(message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this.ws.send(message, isBinary, compress);
	};

   subscribe(topic : string){
		return this.ws.subscribe(topic);
	};

   unsubscribe(topic){
		return this.ws.unsubscribe(topic);
	};
}