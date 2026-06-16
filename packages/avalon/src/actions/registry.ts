/**
 * Server Actions — registry.
 *
 * Flattens a `server` export (a tree of actions and namespace objects) into a
 * flat lookup map keyed by dotted name (e.g. `user.like`).
 *
 * @module actions/registry
 */

import { ACTION_MARKER, type Action, type ActionNamespace } from "./types.ts";

/** Narrows an unknown value to an {@link Action} via the brand marker. */
export function isAction(value: unknown): value is Action {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Record<PropertyKey, unknown>)[ACTION_MARKER] === true
	);
}

/**
 * Recursively flattens a `server` export into `Map<dottedName, Action>`.
 *
 * Nested plain objects become namespaces: `{ user: { like } }` yields the key
 * `"user.like"`. Non-action, non-object values are ignored.
 *
 * @param server - The `server` export (or any sub-namespace).
 * @param prefix - Internal accumulator for the dotted key path.
 */
export function flattenActions(
	server: ActionNamespace | undefined | null,
	prefix = "",
): Map<string, Action> {
	const out = new Map<string, Action>();
	if (!server || typeof server !== "object") return out;

	for (const [key, value] of Object.entries(server)) {
		const name = prefix ? `${prefix}.${key}` : key;
		if (isAction(value)) {
			out.set(name, value);
		} else if (value && typeof value === "object") {
			for (const [nestedName, nestedAction] of flattenActions(value as ActionNamespace, name)) {
				out.set(nestedName, nestedAction);
			}
		}
	}

	return out;
}
