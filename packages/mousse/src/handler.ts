import { Context, ContextTypes, DefaultContextTypes, SustainableContext, UpgradableContext } from "./context.js";

type GenericHandler<
	T extends ContextTypes,
	C extends any,
	Passive extends boolean = false
> = (
	context: C
) => Passive extends true ? (void | Promise<void>) : (void | T["Response"] | Promise<void | T["Response"]>);


// ──────────────────────────
// │ General
// ──────────────────────────

export type Handler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Context<Types>>;
export type MiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Context<Types>, true>;

export type Handlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...MiddlewareHandler<Types, ExtendContext>[], Handler<Types, ExtendContext>];


// ──────────────────────────
// │ WS
// ──────────────────────────
export type WSHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof SustainableContext>, true>;


// ──────────────────────────
// │ POST
// ──────────────────────────
export type POSTHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof UpgradableContext>>;

export type POSTMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof UpgradableContext>, true>;

export type POSTHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...POSTMiddlewareHandler<Types, ExtendContext>[], POSTHandler<Types, ExtendContext>];

// ──────────────────────────
// │ PUT
// ──────────────────────────
export type PUTHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>>;

export type PUTMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>, true>;

export type PUTHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...PUTMiddlewareHandler<Types, ExtendContext>[], PUTHandler<Types, ExtendContext>];


// ──────────────────────────
// │ PATCH
// ──────────────────────────
export type PATCHHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>>;

export type PATCHMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>, true>;

export type PATCHHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...PATCHMiddlewareHandler<Types, ExtendContext>[], PATCHHandler<Types, ExtendContext>];


// ──────────────────────────
// │ HEAD
// ──────────────────────────
export type HEADHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type HEADMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type HEADHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...HEADMiddlewareHandler<Types, ExtendContext>[], HEADHandler<Types, ExtendContext>];


// ──────────────────────────
// │ OPTIONS
// ──────────────────────────
export type OPTIONSHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type OPTIONSMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type OPTIONSHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...OPTIONSMiddlewareHandler<Types, ExtendContext>[], OPTIONSHandler<Types, ExtendContext>];


// ──────────────────────────
// │ GET
// ──────────────────────────
export type GETHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof UpgradableContext>>;

export type GETMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof UpgradableContext>, true>;

export type GETHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...GETMiddlewareHandler<Types, ExtendContext>[], GETHandler<Types, ExtendContext>];


// ──────────────────────────
// │ DELETE
// ──────────────────────────
export type DELHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type DELMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = GenericHandler<Types, ExtendContext & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type DELHandlers<Types extends ContextTypes = DefaultContextTypes, ExtendContext extends any = {}> = [...DELMiddlewareHandler<Types, ExtendContext>[], DELHandler<Types, ExtendContext>];
