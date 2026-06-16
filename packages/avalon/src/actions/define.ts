/**
 * Server Actions — public API surface.
 *
 * Exports `defineAction` for declaring type-safe server functions, the
 * `ActionError` class and `isActionError` guard for structured failures, and
 * `createActionClient` for an explicitly-typed client proxy.
 *
 * Importable as `@useavalon/avalon/actions`.
 *
 * @module actions/define
 */

import { ACTION_MARKER, type Action, type ActionConfig, type ActionErrorCode } from "./types.ts";

/** Maps each {@link ActionErrorCode} to its HTTP status code. */
export const ACTION_ERROR_STATUS: Record<ActionErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	UNSUPPORTED_MEDIA_TYPE: 415,
	INTERNAL_SERVER_ERROR: 500,
};

/** Reverse map: HTTP status → error code (used when rehydrating from a response). */
const STATUS_TO_CODE: Record<number, ActionErrorCode> = Object.fromEntries(
	Object.entries(ACTION_ERROR_STATUS).map(([code, status]) => [status, code as ActionErrorCode]),
) as Record<number, ActionErrorCode>;

/** Options for constructing an {@link ActionError}. */
export interface ActionErrorOptions {
	code: ActionErrorCode;
	message?: string;
	/** Per-field validation issues (for `BAD_REQUEST`). */
	fields?: Record<string, string[]>;
	/** Underlying cause. */
	cause?: unknown;
}

/**
 * A structured error thrown by (or returned from) an action. Carries a stable
 * `code`, the derived HTTP `status`, and optional per-field validation issues.
 */
export class ActionError extends Error {
	readonly code: ActionErrorCode;
	readonly status: number;
	readonly fields?: Record<string, string[]>;

	constructor(options: ActionErrorOptions) {
		super(options.message ?? defaultMessageForCode(options.code), { cause: options.cause });
		this.name = "ActionError";
		this.code = options.code;
		this.status = ACTION_ERROR_STATUS[options.code] ?? 500;
		if (options.fields) this.fields = options.fields;
	}

	/** Rebuilds an {@link ActionError} from a serialized wire format + status. */
	static fromStatus(
		status: number,
		body: { code?: string; message?: string; fields?: Record<string, string[]> } | undefined,
	): ActionError {
		const code =
			(body?.code as ActionErrorCode) ?? STATUS_TO_CODE[status] ?? "INTERNAL_SERVER_ERROR";
		return new ActionError({
			code,
			message: body?.message,
			fields: body?.fields,
		});
	}
}

function defaultMessageForCode(code: ActionErrorCode): string {
	switch (code) {
		case "BAD_REQUEST":
			return "Bad request";
		case "UNAUTHORIZED":
			return "Unauthorized";
		case "FORBIDDEN":
			return "Forbidden";
		case "NOT_FOUND":
			return "Not found";
		case "METHOD_NOT_ALLOWED":
			return "Method not allowed";
		case "CONFLICT":
			return "Conflict";
		case "UNSUPPORTED_MEDIA_TYPE":
			return "Unsupported media type";
		default:
			return "Internal server error";
	}
}

/** Type guard for {@link ActionError}. */
export function isActionError(value: unknown): value is ActionError {
	return value instanceof ActionError;
}

/**
 * Defines a type-safe server action.
 *
 * @example
 * ```ts
 * export const server = {
 *   greet: defineAction({
 *     input: z.object({ name: z.string() }),
 *     handler: async ({ name }) => `Hello, ${name}!`,
 *   }),
 * };
 * ```
 *
 * @param config - The action's input schema, accept mode, and handler.
 * @returns A branded {@link Action} for use under the `server` export.
 */
export function defineAction<TInput, TOutput>(
	config: ActionConfig<TInput, TOutput>,
): Action<TInput, Awaited<TOutput>> {
	const accept = config.accept ?? "json";
	const handler = async (input: TInput, context: Parameters<typeof config.handler>[1]) =>
		(await config.handler(input, context)) as Awaited<TOutput>;

	return {
		[ACTION_MARKER]: true,
		input: config.input,
		accept,
		handler,
	} satisfies Action<TInput, Awaited<TOutput>>;
}

export { createActionClient } from "./client.ts";
export { isAction } from "./registry.ts";
export type {
	AcceptMode,
	Action,
	ActionClient,
	ActionClientOptions,
	ActionConfig,
	ActionContext,
	ActionErrorCode,
	ActionNamespace,
	ActionResult,
	SerializedActionError,
} from "./types.ts";
