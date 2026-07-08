import { Context, ContextTypes, DefaultContextTypes, SustainableContext, UpgradableContext, WSContext } from "./context.js";

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

export type Handler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Context<Types>>;
export type MiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Context<Types>, true>;

export type Handlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...MiddlewareHandler<Types, ContextExtension>[], Handler<Types, ContextExtension>];


// ──────────────────────────
// │ WS
// ──────────────────────────

/**
 * Handler of an established websocket connection : receives a WSContext, not an HTTP Context.
 * Middlewares of a ws route still receive the HTTP Context of the upgrade request.
 */
export type WSHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = (context : ContextExtension & WSContext<Types>) => void | Promise<void>;


// ──────────────────────────
// │ POST
// ──────────────────────────
export type POSTHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof UpgradableContext>>;

export type POSTMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof UpgradableContext>, true>;

export type POSTHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...POSTMiddlewareHandler<Types, ContextExtension>[], POSTHandler<Types, ContextExtension>];

// ──────────────────────────
// │ PUT
// ──────────────────────────
export type PUTHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>>;

export type PUTMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>, true>;

export type PUTHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...PUTMiddlewareHandler<Types, ContextExtension>[], PUTHandler<Types, ContextExtension>];


// ──────────────────────────
// │ PATCH
// ──────────────────────────
export type PATCHHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>>;

export type PATCHMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, keyof SustainableContext | keyof UpgradableContext>, true>;

export type PATCHHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...PATCHMiddlewareHandler<Types, ContextExtension>[], PATCHHandler<Types, ContextExtension>];


// ──────────────────────────
// │ HEAD
// ──────────────────────────
export type HEADHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type HEADMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type HEADHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...HEADMiddlewareHandler<Types, ContextExtension>[], HEADHandler<Types, ContextExtension>];


// ──────────────────────────
// │ OPTIONS
// ──────────────────────────
export type OPTIONSHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type OPTIONSMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type OPTIONSHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...OPTIONSMiddlewareHandler<Types, ContextExtension>[], OPTIONSHandler<Types, ContextExtension>];


// ──────────────────────────
// │ GET
// ──────────────────────────
export type GETHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof UpgradableContext>>;

export type GETMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof UpgradableContext>, true>;

export type GETHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...GETMiddlewareHandler<Types, ContextExtension>[], GETHandler<Types, ContextExtension>];


// ──────────────────────────
// │ DELETE
// ──────────────────────────
export type DELHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>>;

export type DELMiddlewareHandler<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = GenericHandler<Types, ContextExtension & Omit<Context<Types>, "body" | keyof SustainableContext | keyof UpgradableContext>, true>;

export type DELHandlers<Types extends ContextTypes = DefaultContextTypes, ContextExtension extends any = {}> = [...DELMiddlewareHandler<Types, ContextExtension>[], DELHandler<Types, ContextExtension>];
