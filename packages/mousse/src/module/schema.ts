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


/**
 * Schemas attachable to a route. Keys mirror ContextTypes.
 */
export type Schemas = {
	Body? : StandardSchemaV1;
	Query? : StandardSchemaV1;
	Params? : StandardSchemaV1;
	Response? : StandardSchemaV1;
};

export type SchemaPart = 'body' | 'query' | 'params' | 'response';

/**
 * Derive route ContextTypes from a Schemas set, so handlers are typed from the schemas themselves.
 */
export type InferContextTypes<S extends Schemas> = {
	Body : S['Body'] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S['Body']> : any;
	Response : S['Response'] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S['Response']> : any;
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
