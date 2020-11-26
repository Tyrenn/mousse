//@ts-ignore
import { Identifier } from './types.ts';
//@ts-ignore
import { WebSocket, WebSocketMessage } from 'https://deno.land/std@0.78.0/ws/mod.ts';
//@ts-ignore
import { v4 } from 'https://deno.land/std@0.78.0/uuid/mod.ts';


export class WebSocketIDed implements Identifier{
	websocket: WebSocket;
	id: string;

	constructor(websocket: WebSocket, id?: string) {
		this.websocket = websocket;
		if (id) {
			this.id = id;
		}
		else{
			this.id = v4.generate();
		}
	}
}

export class WebSocketPool{

	private websockets: Array<WebSocketIDed>;

	constructor(...websockets: Array<WebSocketIDed>) {
		this.websockets = websockets;
	}

	add(ws: WebSocketIDed) {
		if (!this.has(ws))
			this.websockets.push(ws);
	}

	rm(ws: Identifier | string) {
		let index : number = -1;
		if (typeof ws === "string") {
			index = this.websockets.findIndex((socket) => socket.id == ws)

		}
		else {
			index = this.websockets.findIndex((socket) => socket.id == ws.id)
		}
		if(index > -1)
			this.websockets.splice(index,1);
	}

	get length(): number{
		return this.websockets.length;
	}

	has(ws: Identifier | string): boolean {
		if (typeof ws === "string") {
			return (this.websockets.findIndex((socket) => socket.id == ws)) > -1;
		}
		else {
			return (this.websockets.findIndex((socket) => socket.id == ws.id)) > -1;
		}
		
	}

	broadcast(data : WebSocketMessage) {
		for (let ws of this.websockets) {
			ws.websocket.send(data);
		}
	}
	
	send(ws: Identifier | string, data: WebSocketMessage) {
		let index: number = -1;
		if (typeof ws === "string") {
			index = this.websockets.findIndex((socket) => socket.id == ws)
		}
		else {
			index = this.websockets.findIndex((socket) => socket.id == ws.id)
		}
		if (index > -1)
			this.websockets[index].websocket.send(data);
	}
}