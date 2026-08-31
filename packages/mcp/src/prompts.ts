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
				const text = [
					`Create an Avalon island for: ${component}.`,
					"",
					`Desired hydration: ${hydration}.`,
					"",
					"Requirements:",
					"- Write the island as a framework component (default: Preact with `/** @jsxImportSource preact */`).",
					"- Use it in a page via the `island` prop: `island={{ condition: '...' }}`.",
					"- Do NOT use Astro `client:*` attributes — they do not exist in Avalon.",
					"- If unsure which condition to use, call the `avalon_hydration_directive` tool.",
				].join("\n");
				return {
					description: "Create an Avalon island",
					messages: [userMessage(text)],
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
				const text = [
					"Review the following code for Avalon correctness. Flag and fix any Astro-only constructs (`client:*` attributes, `.astro` files, `Astro.*` globals, `astro:actions`, `getStaticPaths`). Prefer running the `avalon_lint` tool first, then explain each fix.",
					"",
					"```tsx",
					code,
					"```",
				].join("\n");
				return {
					description: "Review code for Avalon correctness",
					messages: [userMessage(text)],
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
				const text = [
					"Migrate this Astro code to Avalon. Steps:",
					"1. Call `avalon_convert_astro` to rewrite `client:*` directives and detect Astro-isms.",
					"2. Replace `.astro` structure with a `.tsx` component (module-scope imports, JSX return).",
					"3. Replace `Astro.*` usage with props and the H3 `event`.",
					"4. Move any `astro:actions` to `@useavalon/avalon/actions`.",
					"5. Output the final Avalon file and a short summary of changes.",
					"",
					"```astro",
					code,
					"```",
				].join("\n");
				return {
					description: "Migrate Astro to Avalon",
					messages: [userMessage(text)],
				};
			},
		},
	];
}
