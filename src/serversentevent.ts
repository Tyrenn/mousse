import { ServerRequest } from 'https://deno.land/std@0.78.0/http/server.ts';
import { v4 } from 'https://deno.land/std@0.78.0/uuid/mod.ts';
import { encode } from "https://deno.land/std@0.78.0/encoding/utf8.ts";

export type Identifier = { id: string }

export interface ServerSentEventInit extends EventInit{
  replacer?: (string | number)[] | ((this: any, key: string, value: any) => any);
  space?: string | number;
}

export class ServerSentCloseEvent extends Event{
  readonly code: number;
  readonly reason?: string;

  constructor(code: number, reason?:string, eventInit? : EventInit) {
    super("close", eventInit);
    this.code = code;
    this.reason = reason;
  }
}

export class ServerSentEvent extends Event{
  #type: string;
  #data: string = "";

  constructor(type : string, data : any, { replacer, space, ...eventInit }: ServerSentEventInit = {}) {
    super(type, eventInit);
    this.#type = type;
    try {
      this.#data = typeof data === "string" ?
        data : JSON.stringify(data, replacer as (string | number)[], space);
    } catch (error) {
      console.error("Data can't be stringified : ", error);
    }
  }

  get data(): string {
    return this.#data;
  }
  
  toString(): string {
    const data = `data: ${this.#data.split("\n").join("\ndata: ")}\n`;
    return `event: ${this.#type}\n${data}\n`;
  }
}

export class SSEIDed implements Identifier{
	request: ServerRequest;
	id: string;

	constructor(request: ServerRequest, id?: string) {
		this.request = request;
		if (id) {
			this.id = id;
		}
		else{
			this.id = v4.generate();
		}
	}
}


export class SSEPool{

	#sses: Array<SSEIDed>;

	constructor(...sses: Array<SSEIDed>) {
		this.#sses = sses;
	}

  clone(): SSEPool{
    return new SSEPool(...this.#sses);
  }

	add(sse: SSEIDed) {
		if (!this.has(sse))
			this.#sses.push(sse);
	}

	rm(id: Identifier | string) {
		let index : number = -1;
		if (typeof id === "string") {
			index = this.#sses.findIndex((sse) => sse.id == id)

		}
		else {
			index = this.#sses.findIndex((sse) => sse.id == id.id)
		}
		if(index > -1)
			this.#sses.splice(index,1);
	}

	get length(): number{
		return this.#sses.length;
	}

	has(id: Identifier | string): boolean {
		if (typeof id === "string") {
			return (this.#sses.findIndex((sse) => sse.id == id)) > -1;
		}
		else {
			return (this.#sses.findIndex((sse) => sse.id == id.id)) > -1;
		}
		
	}

  async broadcast(data: string | Uint8Array) {
    const payload = typeof data === "string" ? encode(data) : data;
    for (let sse of this.#sses) {
      await sse.request.w.write(payload);
      await sse.request.w.flush();
		}
	}
	
	async send(id: Identifier | string, data: string | Uint8Array) {
		let index: number = -1;
		if (typeof id === "string") {
			index = this.#sses.findIndex((sse) => sse.id == id)
		}
		else {
			index = this.#sses.findIndex((sse) => sse.id == id.id)
		}
    if (index > -1) {
      const payload = typeof data === "string" ? encode(data) : data;
      await this.#sses[index].request.w.write(payload);
      await this.#sses[index].request.w.flush();
    }
	}
}