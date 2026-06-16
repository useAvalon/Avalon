/**
 * Server Actions — request/response serialization.
 *
 * Parses incoming request bodies (JSON or form) into action input, serializes
 * errors into the wire format, and parses client-side responses into an
 * {@link ActionResult}.
 *
 * @module actions/serialization
 */

import type { H3Event } from "h3";
import type { z } from "zod";
import { ActionError } from "./define.ts";
import type { AcceptMode, ActionResult, SerializedActionError } from "./types.ts";

/** Resolves the web-standard Request from an H3 event, when available. */
export function getWebRequest(event: H3Event): Request | undefined {
	const evt = event as unknown as {
		req?: unknown;
		web?: { request?: Request };
		request?: Request;
	};
	// h3 v2 exposes the web-standard Request as `event.req`.
	if (evt.req && typeof (evt.req as Request).text === "function") {
		return evt.req as Request;
	}
	return evt.web?.request ?? evt.request ?? undefined;
}

/** Reads a Node IncomingMessage stream into a string. */
function readNodeBody(req: { on: (ev: string, cb: (arg?: any) => void) => void }): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

/** Collapses FormData into a plain object (repeated keys → arrays). */
function formDataToObject(form: FormData): Record<string, unknown> {
	const obj: Record<string, unknown> = {};
	for (const key of new Set(form.keys())) {
		const all = form.getAll(key);
		obj[key] = all.length > 1 ? all : all[0];
	}
	return obj;
}

/** Parses a urlencoded body string into a plain object (repeated keys → arrays). */
function urlencodedToObject(body: string): Record<string, unknown> {
	const params = new URLSearchParams(body);
	const obj: Record<string, unknown> = {};
	for (const key of new Set(params.keys())) {
		const all = params.getAll(key);
		obj[key] = all.length > 1 ? all : all[0];
	}
	return obj;
}

/**
 * Parses the request body into raw action input.
 *
 * - `accept: "form"` (or a form content-type) → parses FormData / urlencoded.
 * - otherwise → parses JSON (empty body → `undefined`).
 *
 * @throws {ActionError} `UNSUPPORTED_MEDIA_TYPE` / `BAD_REQUEST` on malformed bodies.
 */
export async function parseRequestInput(event: H3Event, accept: AcceptMode): Promise<unknown> {
	const request = getWebRequest(event);
	const contentType = (
		request?.headers.get("content-type") ??
		(event as any).node?.req?.headers?.["content-type"] ??
		""
	).toLowerCase();

	const isForm =
		accept === "form" ||
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded");

	if (isForm) {
		if (request && contentType.includes("multipart/form-data")) {
			try {
				return formDataToObject(await request.formData());
			} catch (err) {
				throw new ActionError({ code: "BAD_REQUEST", message: "Invalid form data", cause: err });
			}
		}
		// urlencoded (or no web Request available): read raw body text.
		const text = await readBodyText(event, request);
		return urlencodedToObject(text);
	}

	// JSON (default)
	const text = await readBodyText(event, request);
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new ActionError({ code: "BAD_REQUEST", message: "Invalid JSON body", cause: err });
	}
}

/** Reads the raw request body as text from a web Request or node stream. */
async function readBodyText(event: H3Event, request: Request | undefined): Promise<string> {
	if (request) {
		return await request.text();
	}
	const nodeReq = (event as any).node?.req;
	if (nodeReq?.on) {
		return await readNodeBody(nodeReq);
	}
	const preParsed = (event as any)._body;
	if (preParsed !== undefined) {
		return typeof preParsed === "string" ? preParsed : JSON.stringify(preParsed);
	}
	return "";
}

/** Builds the `fields` map from a Zod error's issues (Zod v4 uses `.issues`). */
export function zodIssuesToFields(error: z.ZodError): Record<string, string[]> {
	const fields: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.length > 0 ? issue.path.join(".") : "_";
		const list = fields[key] ?? [];
		list.push(issue.message);
		fields[key] = list;
	}
	return fields;
}

/**
 * Serializes an error into the wire format and its HTTP status. Unexpected
 * (non-ActionError) errors become `INTERNAL_SERVER_ERROR`; their message is
 * included only in development.
 */
export function serializeError(
	err: unknown,
	isDev: boolean,
): { status: number; body: SerializedActionError } {
	if (err instanceof ActionError) {
		return {
			status: err.status,
			body: {
				code: err.code,
				message: err.message,
				...(err.fields ? { fields: err.fields } : {}),
			},
		};
	}

	const message = isDev && err instanceof Error ? err.message : "Internal server error";
	return {
		status: 500,
		body: { code: "INTERNAL_SERVER_ERROR", message },
	};
}

/**
 * Parses a fetch Response into an {@link ActionResult}. Used by the client
 * proxy. Never throws — network/parse issues become an error result.
 */
export async function parseClientResult<T>(response: Response): Promise<ActionResult<T>> {
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		body = undefined;
	}

	if (response.ok) {
		const data = (body as { data?: T } | undefined)?.data as T;
		return { data, error: undefined };
	}

	const errBody = (body as { error?: SerializedActionError } | undefined)?.error;
	return {
		data: undefined,
		error: ActionError.fromStatus(response.status, errBody),
	};
}
