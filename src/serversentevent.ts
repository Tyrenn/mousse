
export interface ServerSentEventInit extends EventInit{
  replacer?: (string | number)[] | ((this: any, key: string, value: any) => any);
  space?: string | number;
}

export class ServerSentEvent extends Event{
  #type: string;
  #data: string;

  constructor(type : string, data : any, { replacer, space, ...eventInit }: ServerSentEventInit = {}) {
    super(type, eventInit);
    this.#type = type;
    try {
      this.#data = typeof data === "string"
        ? data
        : JSON.stringify(data, replacer as (string | number)[], space);
    } catch (e) {
      throw new TypeError(
        `data could not be coerced into a serialized string.\n  ${e.message}`,
      );
    }
  }

  get data(): string {
    return this.#data;
  }
} 