
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