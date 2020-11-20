export class WSContext<T = any>{
  websocket: WebSocket;
  url: string;
  params : Record<string, string>;
  processedUrl: string;
  data: T | undefined;

  constructor(url : string, websocket : WebSocket){
    this.params = {};
    this.url = url;
    this.websocket = websocket;
    this.processedUrl = "";
  }
  //TODO : add helpers for response : cookies, contenttype, renderer ?
}