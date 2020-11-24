//@ts-ignore
import { Identifier } from './types.ts';
//@ts-ignore
import { WebSocket, WebSocketMessage } from 'https://deno.land/std@0.78.0/ws/mod.ts';


export class WebSocketPool{

  private websockets: Array<WebSocket & Identifier>;

  constructor(...websockets: Array<WebSocket & Identifier>) {
    this.websockets = websockets;
  }

  add(ws : WebSocket & Identifier) {
    this.websockets.push(ws);
  }

  rm(ws : (WebSocket & Identifier) | Identifier) {
    let index = this.websockets.findIndex((socket) => socket.id == ws.id);
    if(index > -1){
      this.websockets.splice(index,1);
    }
  }

  get length(): number{
    return this.websockets.length;
  }

  send(data : WebSocketMessage) {
    for (let ws of this.websockets) {
      ws.send(data);
    }
  }
}