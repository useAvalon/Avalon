/**
 * Server Actions — typed client proxy.
 *
 * `createActionClient<typeof server>()` returns a Proxy whose property accesses
 * mirror the `server` export. Calling an action POSTs to `/_actions/<name>` and
 * resolves to an {@link ActionResult}. The proxy never throws for action-level
 * failures — network/parse errors also resolve to an error result.
 *
 * This module contains ONLY the fetch proxy (no handler source), so it is safe
 * to include in the browser bundle.
 *
 * @module actions/client
 */

import { ActionError } from "./define.ts";
import { parseClientResult } from "./serialization.ts";
import type { ActionClient, ActionClientOptions, ActionResult } from "./types.ts";

const DEFAULT_BASE = "/_actions";

/** Performs a single action request and resolves to an {@link ActionResult}. */
async function callAction(
	baseUrl: string,
	fetchImpl: typeof fetch,
	name: string,
	input: unknown,
): Promise<ActionResult<unknown>> {
	const url = `${baseUrl}/${name}`;
	try {
		let body: BodyInit | undefined;
		const headers: Record<string, string> = {};

		if (input instanceof FormData) {
			// Let the runtime set the multipart boundary Content-Type.
			body = input;
		} else if (input !== undefined) {
			body = JSON.stringify(input);
			headers["Content-Type"] = "application/json";
		}

		const response = await fetchImpl(url, { method: "POST", body, headers });
		return await parseClientResult(response);
	} catch (err) {
		return {
			data: undefined,
			error: new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: err instanceof Error ? err.message : "Request failed",
				cause: err,
			}),
		};
	}
}

/**
 * Creates a typed client proxy for calling server actions.
 *
 * @typeParam T - The `server` export type (for inference).
 * @param options - Optional base URL / custom fetch.
 */
export function createActionClient<T = Record<string, never>>(
	options: ActionClientOptions = {},
): ActionClient<T> {
	const baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
	const fetchImpl = options.fetch ?? globalThis.fetch;

	const build = (prefix: string): unknown =>
		new Proxy(
			// Use a function target so the proxy is callable at any depth.
			((input: unknown) => callAction(baseUrl, fetchImpl, prefix, input)) as object,
			{
				get(_target, prop) {
					if (typeof prop !== "string") return undefined;
					const next = prefix ? `${prefix}.${prop}` : prop;
					return build(next);
				},
				apply(_target, _thisArg, args: unknown[]) {
					return callAction(baseUrl, fetchImpl, prefix, args[0]);
				},
			},
		);

	return build("") as ActionClient<T>;
}
