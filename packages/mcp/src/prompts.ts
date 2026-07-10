/**
 * MCP prompt definitions for the Avalon server.
 *
 * Prompts are reusable, parameterised instructions a client can surface to the
 * user (e.g. slash commands). They steer the model toward correct Avalon usage.
 *
 * @module prompts
 */

import { textResult } from "./protocol/server.ts";
import type { PromptDefinition } from "./protocol/types.ts";

function userMessage(text: string) {
	return { role: "user" as const, content: textResult(text).content[0] };
}

/** Build the list of Avalon MCP prompts. */
export function createPrompts(): PromptDefinition[] {
	return [
		{
			name: "avalon_island",
			title: "Create an Avalon island",
			description:
				"Guide the model to build an interactive Avalon island with the correct hydration syntax.",
			arguments: [
				{ name: "component", description: "What the island should do/render.", required: true },
				{
					name: "hydration",
					description: "Desired hydration behaviour (e.g. 'when visible', 'on click').",
					required: false,
				},
			],
			handler: (args) => {
				const component = args.component ?? "an interactive component";
				const hydration = args.hydration ?? "on:client";
				return {
					description: "Create an Avalon island",
					messages: [
						userMessage(
							`Create an Avalon island for: ${component}.\n\n` +
								`Desired hydration: ${hydration}.\n\n` +
								"Requirements:\n" +
								"- Write the island as a framework component (default: Preact with `/** @jsxImportSource preact */`).\n" +
								"- Use it in a page via the `island` prop: `island={{ condition: '...' }}`.\n" +
								"- Do NOT use Astro `client:*` attributes — they do not exist in Avalon.\n" +
								"- If the sole child of a page/layout is the island, wrap it in a container element.\n" +
								"- If unsure which condition to use, call the `avalon_hydration_directive` tool.",
						),
					],
				};
			},
		},

		{
			name: "avalon_review",
			title: "Review code for Astro/Avalon confusion",
			description:
				"Ask the model to review a snippet and fix any Astro syntax that doesn't exist in Avalon.",
			arguments: [{ name: "code", description: "The code to review.", required: true }],
			handler: (args) => {
				const code = args.code ?? "";
				return {
					description: "Review code for Avalon correctness",
					messages: [
						userMessage(
							"Review the following code for Avalon correctness. Flag and fix any Astro-only " +
								"constructs (`client:*` attributes, `.astro` files, `Astro.*` globals, " +
								"`astro:actions`, `getStaticPaths`). Prefer running the `avalon_lint` tool first, " +
								"then explain each fix.\n\n```tsx\n" +
								code +
								"\n```",
						),
					],
				};
			},
		},

		{
			name: "avalon_migrate_from_astro",
			title: "Migrate an Astro file to Avalon",
			description: "Guide a full conversion of an Astro component/page to idiomatic Avalon.",
			arguments: [{ name: "code", description: "The Astro source to migrate.", required: true }],
			handler: (args) => {
				const code = args.code ?? "";
				return {
					description: "Migrate Astro to Avalon",
					messages: [
						userMessage(
							"Migrate this Astro code to Avalon. Steps:\n" +
								"1. Call `avalon_convert_astro` to rewrite `client:*` directives and detect Astro-isms.\n" +
								"2. Replace `.astro` structure with a `.tsx` component (module-scope imports, JSX return).\n" +
								"3. Replace `Astro.*` usage with props and the H3 `event`.\n" +
								"4. Move any `astro:actions` to `@useavalon/avalon/actions`.\n" +
								"5. Output the final Avalon file and a short summary of changes.\n\n```astro\n" +
								code +
								"\n```",
						),
					],
				};
			},
		},
	];
}
