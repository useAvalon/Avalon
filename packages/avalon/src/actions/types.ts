/**
 * Server Actions — shared types.
 *
 * @module actions/types
 */

import type { H3Event } from "h3";
import type { z } from "zod";

/** Unique marker distinguishing an Action from a plain namespace object. */
export const ACTION_MARKER = Symbol.for("avalon.action");

/**
 * Stable error codes for action failures. Each maps to an HTTP status
 * (see `ACTION_ERROR_STATUS` in `define.ts`).
 */
export type ActionErrorCode =
	| "BAD_REQUEST"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "METHOD_NOT_ALLOWED"
	| "CONFLICT"
	| "UNSUPPORTED_MEDIA_TYPE"
	| "INTERNAL_SERVER_ERROR";

/** How the endpoint parses the request body for an action. */
export type AcceptMode = "json" | "form";

/**
 * Context passed to every action handler. Provides access to the underlying
 * request so handlers can read cookies, headers, and perform auth checks.
 */
export interface ActionContext {
	/** The raw Nitro/H3 event. */
	event: H3Event;
	/** The web-standard Request, when available on the event. */
	request: Request | undefined;
	/** Minimal cookie accessor (reads from the request `Cookie` header). */
	cookies: { get(name: string): string | undefined };
	/** Request headers. */
	headers: Headers;
}

/**
 * Configuration accepted by {@link defineAction}.
 *
 * @typeParam TInput - The validated input type (inferred from `input`).
 * @typeParam TOutput - The handler's return type.
 */
export interface ActionConfig<TInput, TOutput> {
	/** Optional Zod schema validating the input before the handler runs. */
	input?: z.ZodType<TInput>;
	/** Body parsing mode. Defaults to `"json"`. */
	accept?: AcceptMode;
	/** The server-side handler. Receives validated input and a context. */
	handler: (input: TInput, context: ActionContext) => TOutput | Promise<TOutput>;
}

/**
 * A defined server action. Branded with {@link ACTION_MARKER} so the registry
 * builder can distinguish actions from namespace objects.
 */
export interface Action<TInput = unknown, TOutput = unknown> {
	readonly [ACTION_MARKER]: true;
	/** Optional Zod input schema. */
	readonly input?: z.ZodType<TInput>;
	/** Resolved accept mode. */
	readonly accept: AcceptMode;
	/** The handler (always returns a promise once normalized). */
	readonly handler: (input: TInput, context: ActionContext) => Promise<TOutput>;
}

/** Wire format for a serialized error. */
export interface SerializedActionError {
	code: ActionErrorCode;
	message: string;
	/** Per-field validation issues (present for `BAD_REQUEST` validation errors). */
	fields?: Record<string, string[]>;
}

/**
 * Discriminated result returned by the client proxy. Exactly one of `data` /
 * `error` is populated. The client never throws for action-level failures.
 */
export type ActionResult<TOutput, TError = SerializedActionError> =
	| { data: TOutput; error: undefined }
	| { data: undefined; error: TError };

/** A tree of actions and namespaces, as exported under `server`. */
export interface ActionNamespace {
	[key: string]: Action<any, any> | ActionNamespace;
}

/**
 * Maps a `server` export to its client surface: each {@link Action} becomes an
 * async callable returning an {@link ActionResult}; each namespace maps to a
 * nested client.
 */
export type ActionClient<T> = {
	[K in keyof T]: T[K] extends Action<infer I, infer O>
		? undefined extends I
			? (input?: I) => Promise<ActionResult<O>>
			: (input: I) => Promise<ActionResult<O>>
		: T[K] extends ActionNamespace
			? ActionClient<T[K]>
			: never;
};

/** Options for {@link createActionClient}. */
export interface ActionClientOptions {
	/**
	 * Base URL/path for the actions endpoint. Defaults to `/_actions`.
	 * Provide an absolute origin (e.g. `https://api.example.com/_actions`) for
	 * cross-origin usage.
	 */
	baseUrl?: string;
	/** Optional custom fetch implementation (testing / non-browser runtimes). */
	fetch?: typeof fetch;
}
