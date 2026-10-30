/**
 * The Standard Schema v1 interface — https://standardschema.dev (MIT)
 * Implemented natively by Zod (>= 3.24), ArkType, Valibot and others :
 * any schema from these libraries can be used directly in route options.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
	export interface Props<Input = unknown, Output = Input> {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
		readonly types?: Types<Input, Output> | undefined;
	}

	export type Result<Output> = SuccessResult<Output> | FailureResult;

	export interface SuccessResult<Output> {
		readonly value: Output;
		readonly issues?: undefined;
	}

	export interface FailureResult {
		readonly issues: ReadonlyArray<Issue>;
	}

	export interface Issue {
		readonly message: string;
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	export interface PathSegment {
		readonly key: PropertyKey;
	}

	export interface Types<Input = unknown, Output = Input> {
		readonly input: Input;
		readonly output: Output;
	}

	export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];

	export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}


export type ResponseStatusRange = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

/**
 * Response schemas keyed by status : exact codes win over ranges ('4xx').
 */
export type ResponseSchemaMap = Partial<Record<number | ResponseStatusRange, StandardSchemaV1>>;

/**
 * Schemas attachable to a route. Keys mirror ContextTypes.
 * A single Response schema describes 2xx responses ; use a ResponseSchemaMap to describe others.
 */
export type Schemas = {
	Body? : StandardSchemaV1;
	Query? : StandardSchemaV1;
	Params? : StandardSchemaV1;
	Response? : StandardSchemaV1 | ResponseSchemaMap;
};

export function isStandardSchema(value : unknown) : value is StandardSchemaV1 {
	return !!value && typeof value === 'object' && '~standard' in value;
}

/**
 * Every schema of a Response option, keyed by status ('2xx' for a single schema)
 */
export function responseSchemaEntries(response : Schemas['Response']) : [string, StandardSchemaV1][] {
	if(!response)
		return [];

	if(isStandardSchema(response))
		return [['2xx', response]];

	return Object.entries(response).filter((entry) : entry is [string, StandardSchemaV1] => isStandardSchema(entry[1]));
}

/**
 * Schema applying to a response status : exact code first, then its range. A single schema covers 2xx.
 */
export function responseSchemaFor(response : Schemas['Response'], statusCode : number) : StandardSchemaV1 | undefined {
	if(!response)
		return undefined;

	const range = `${Math.floor(statusCode / 100)}xx` as ResponseStatusRange;

	if(isStandardSchema(response))
		return range === '2xx' ? response : undefined;

	return response[statusCode] ?? response[range];
}

export type SchemaPart = 'body' | 'query' | 'params' | 'response';

type SchemaOutput<S> = S extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S> : never;

type IsSuccessKey<K> = `${K & (string | number)}` extends `2${string}` ? true : false;

type NeverToAny<T> = [T] extends [never] ? any : T;

/**
 * Output of the 2xx response schemas : what a handler returns
 */
export type InferSuccessResponse<R> = R extends StandardSchemaV1
	? SchemaOutput<R>
	: R extends ResponseSchemaMap ? {[K in keyof R] : IsSuccessKey<K> extends true ? SchemaOutput<R[K]> : never}[keyof R] : any;

/**
 * Output of the non 2xx response schemas : what c.json() also accepts, along with a status
 */
export type InferErrorResponse<R> = R extends ResponseSchemaMap
	? R extends StandardSchemaV1 ? never : {[K in keyof R] : IsSuccessKey<K> extends true ? never : SchemaOutput<R[K]>}[keyof R]
	: never;

/**
 * Derive route ContextTypes from a Schemas set, so handlers are typed from the schemas themselves.
 */
export type InferContextTypes<S extends Schemas> = {
	Body : S['Body'] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S['Body']> : any;
	Response : S['Response'] extends object ? NeverToAny<InferSuccessResponse<S['Response']>> : any;
	ErrorResponse : InferErrorResponse<S['Response']>;
	Query : S['Query'] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S['Query']> : any;
	Params : S['Params'] extends StandardSchemaV1 ? Extract<keyof StandardSchemaV1.InferOutput<S['Params']>, string> : string;
};


export class SchemaValidationError extends Error {
	part : SchemaPart;
	issues : ReadonlyArray<StandardSchemaV1.Issue>;

	constructor(part : SchemaPart, issues : ReadonlyArray<StandardSchemaV1.Issue>){
		super(`Invalid ${part} : ${issues.map(issue => issue.message).join(', ')}`);
		this.name = 'SchemaValidationError';
		this.part = part;
		this.issues = issues;
	}
}

/**
 * Run a Standard Schema validation, throwing a SchemaValidationError on failure.
 */
export async function validateSchema(schema : StandardSchemaV1, part : SchemaPart, value : unknown) : Promise<unknown> {
	let result = schema['~standard'].validate(value);

	if(result instanceof Promise)
		result = await result;

	if(result.issues)
		throw new SchemaValidationError(part, result.issues);

	return result.value;
}

/**
 * Synchronous variant used where awaiting is not possible (response serialization).
 */
export function validateSchemaSync(schema : StandardSchemaV1, part : SchemaPart, value : unknown) : unknown {
	const result = schema['~standard'].validate(value);

	if(result instanceof Promise)
		throw new TypeError(`Schema for ${part} must validate synchronously`);

	if(result.issues)
		throw new SchemaValidationError(part, result.issues);

	return result.value;
}
