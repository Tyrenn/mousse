import {RecognizedString, WebSocket as uWSWebSocket} from 'uWebSockets.js';

export type WebSocketOptions = {
	maxBackPressure ? : number;
}

export class WebSocket {

	private _ws : uWSWebSocket<undefined>;

	private _bufferQueue : RecognizedString[] = [];

	maxBackPressure : number;

	constructor(ws : uWSWebSocket<undefined>, options? : WebSocketOptions){
		this.maxBackPressure = options?.maxBackPressure ?? 16 * 1024; // Default to 16kb
		this._ws = ws;
	}

	get bufferedAmount(){
		return this._ws.getBufferedAmount();
	};
	
	get remoteAddress(){
		return this._ws.getRemoteAddress();
	};

	get remoteAddressAsText(){
		return this._ws.getRemoteAddressAsText();
	};

	get topics(){
		return this._ws.getTopics();
	}

	isSubscribed(topic : string){
		return this._ws.isSubscribed(topic);
	};

	ping(message : RecognizedString){
		return this._ws.ping(message);
	};

	publish(topic : string, message : RecognizedString, isBinary? : boolean, compress? : boolean){
		return this._ws.publish(topic, message, isBinary, compress);
	};

	send(message : RecognizedString, isBinary? : boolean, compress? : boolean){
		if (this._ws.getBufferedAmount() < this.maxBackPressure)
			return this._ws.send(message, isBinary, compress);
		else
			this._bufferQueue.push(message);
		return 0;
	};

	subscribe(topic : string){
		return this._ws.subscribe(topic);
	};

	unsubscribe(topic : string){
		return this._ws.unsubscribe(topic);
	};

	drain(){
		while(this._bufferQueue.length > 0 && this._ws.getBufferedAmount() < this.maxBackPressure) {
			const nextMessage = this._bufferQueue.shift();
			if(nextMessage)
				this._ws.send(nextMessage);
		}
	}
}