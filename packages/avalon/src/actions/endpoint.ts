/**
 * Server Actions — endpoint handler.
 *
 * Factory producing an H3/Nitro handler for `/_actions/:name`. Performs method
 * guarding, action lookup, body parsing, Zod validation, handler execution, and
 * error serialization — returning a JSON `{ data }` or `{ error }` response.
 *
 * @module actions/endpoint
 */

import type { H3Event } from "h3";
import { ActionError } from "./define.ts";
import {
	getWebRequest,
	parseRequestInput,
	serializeError,
	zodIssuesToFields,
} from "./serialization.ts";
import type { Action, ActionContext } from "./types.ts";

/** Options for {@link defineActionHandler}. */
export interface ActionHandlerOptions {
	/** The flattened action registry (name → Action). */
	registry: Map<string, Action>;
	/** Whether running in development (controls error message exposure). */
	isDev?: boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/** Builds a JSON Response. */
function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Creates the action endpoint handler.
 *
 * @param options - Registry and dev flag.
 * @returns An async H3 handler returning a web `Response`.
 */
export function defineActionHandler(options: ActionHandlerOptions) {
	const { registry, isDev = process.env.NODE_ENV !== "production" } = options;

	return async (event: H3Event): Promise<Response> => {
		// 1. Method guard — actions are POST-only.
		if (getMethod(event).toUpperCase() !== "POST") {
			return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
		}

		// 2. Resolve action name from the path.
		const name = extractActionName(event);
		if (!name) {
			return json({ error: { code: "BAD_REQUEST", message: "Missing action name" } }, 400);
		}

		// 3. Look up the action.
		const action = registry.get(name);
		if (!action) {
			return json({ error: { code: "NOT_FOUND", message: `Unknown action: ${name}` } }, 404);
		}

		// 4. Parse the request body into raw input.
		let raw: unknown;
		try {
			raw = await parseRequestInput(event, action.accept);
		} catch (err) {
			const { status, body } = serializeError(err, isDev);
			return json({ error: body }, status);
		}

		// 5. Validate with the action's input schema (when present).
		let input: unknown = raw;
		if (action.input) {
			const result = action.input.safeParse(raw);
			if (!result.success) {
				return json(
					{
						error: {
							code: "BAD_REQUEST",
							message: "Validation failed",
							fields: zodIssuesToFields(result.error),
						},
					},
					400,
				);
			}
			input = result.data;
		}

		// 6. Build the handler context.
		const context = buildContext(event);

		// 7. Run the handler.
		try {
			const data = await action.handler(input, context);
			return json({ data }, 200);
		} catch (err) {
			if (!(err instanceof ActionError)) {
				console.error("[actions] Handler error for", name, err);
			}
			const { status, body } = serializeError(err, isDev);
			return json({ error: body }, status);
		}
	};
}

/** Builds the {@link ActionContext} from an H3 event. */
function buildContext(event: H3Event): ActionContext {
	const request = getWebRequest(event);
	const headers =
		request?.headers ??
		new Headers(((event as any).node?.req?.headers ?? {}) as Record<string, string>);
	const cookieHeader = headers.get("cookie") ?? "";
	return {
		event,
		request,
		headers,
		cookies: { get: (name: string) => parseCookie(cookieHeader, name) },
	};
}

/** Reads a single cookie value from a Cookie header string. */
function parseCookie(cookieHeader: string, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	for (const part of cookieHeader.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		const key = part.slice(0, eq).trim();
		if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
	}
	return undefined;
}

/** Gets the request method (avoids deprecated `event.method`). */
function getMethod(event: H3Event): string {
	const request = getWebRequest(event);
	if (request) return request.method;
	return (event as any).node?.req?.method ?? "GET";
}

/**
 * Extracts the action name from the URL path (`/_actions/<name>`). Supports
 * dotted nested names (`/_actions/user.like`).
 */
function extractActionName(event: H3Event): string | undefined {
	const params = (event as any).context?.params;
	if (params?.name) return decodeURIComponent(String(params.name));

	const pathname = getPathname(event);
	const match = /\/_actions\/([^/?]+)/.exec(pathname);
	return match ? decodeURIComponent(match[1]) : undefined;
}

/** Gets the pathname from an H3 event. */
function getPathname(event: H3Event): string {
	if (event.url) return event.url.pathname;
	const reqUrl = (event as any).node?.req?.url as string | undefined;
	if (reqUrl) return new URL(reqUrl, "http://localhost").pathname;
	return "/";
}
