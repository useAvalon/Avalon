/**
 * Server Actions for the Avalon demo site.
 *
 * Actions are type-safe server functions. Define them under the `server` export
 * and call them from the client via `import { actions } from "avalon/actions"`.
 */

import { ActionError, defineAction } from "@useavalon/avalon/actions";
import { z } from "zod";

export const server = {
	/** A simple JSON action with Zod-validated input. */
	greet: defineAction({
		input: z.object({ name: z.string().min(1, "Name is required") }),
		handler: ({ name }) => {
			return {
				message: `Hello, ${name}!`,
				at: new Date().toISOString(),
			};
		},
	}),

	/** A progressive-enhancement form action (parses FormData). */
	subscribe: defineAction({
		accept: "form",
		input: z.object({
			email: z.string().email("Enter a valid email address"),
		}),
		handler: ({ email }) => {
			return { subscribed: true, email };
		},
	}),

	/** Nested namespace + an action that demonstrates structured errors. */
	demo: {
		secret: defineAction({
			input: z.object({ token: z.string() }),
			handler: ({ token }) => {
				if (token !== "open-sesame") {
					throw new ActionError({ code: "FORBIDDEN", message: "Wrong token" });
				}
				return { secret: "42 is the answer" };
			},
		}),
	},
};
