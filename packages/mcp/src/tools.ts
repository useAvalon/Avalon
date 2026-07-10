/**
 * MCP tool definitions for the Avalon server.
 *
 * These tools are the primary way an agent interacts with Avalon knowledge:
 * looking up the correct hydration syntax, converting Astro code, linting for
 * Astro-isms, searching docs, and scaffolding idiomatic files.
 *
 * @module tools
 */

import { apiReferenceMarkdown } from "./knowledge/api.ts";
import {
	CONCEPT_MAP,
	convertSnippet,
	DIRECTIVE_MAP,
	lintForAstroisms,
} from "./knowledge/astro-map.ts";
import {
	ALL_CONDITIONS,
	CORE_CONDITIONS,
	CUSTOM_DIRECTIVES,
	findCondition,
	type HydrationCondition,
	ISLAND_PROP_REFERENCE,
} from "./knowledge/directives.ts";
import { DOC_TOPICS, getDoc, searchDocs } from "./knowledge/docs.ts";
import { scaffold, SCAFFOLD_KINDS, type ScaffoldKind } from "./knowledge/scaffold.ts";
import { textResult } from "./protocol/server.ts";
import type { ToolDefinition } from "./protocol/types.ts";

function conditionToMarkdown(c: HydrationCondition): string {
	const lines = [
		`### \`${c.condition}\``,
		"",
		c.summary,
		"",
		`- **Mechanism:** ${c.mechanism}`,
		`- **Takes conditionArg:** ${c.takesArg ? `yes — ${c.argDescription ?? ""}` : "no"}`,
		`- **Use when:** ${c.useWhen}`,
	];
	if (c.requiresRegistration) {
		lines.push("- **Note:** custom directive — enable via `registerBuiltinDirectives()`.");
	}
	lines.push("", "```tsx", c.example, "```");
	return lines.join("\n");
}

/** Build the list of Avalon MCP tools. */
export function createTools(): ToolDefinition[] {
	return [
		{
			name: "avalon_hydration_directive",
			title: "Avalon hydration directive helper",
			description:
				"Return the correct Avalon `island` prop syntax for a desired hydration behaviour. " +
				"Accepts either an Avalon condition (e.g. 'on:visible'), a plain-English behaviour " +
				"(e.g. 'when visible', 'on click', 'after 2 seconds'), or an Astro directive " +
				"(e.g. 'client:load'). Use this whenever you need to make a component interactive in Avalon.",
			inputSchema: {
				type: "object",
				properties: {
					behavior: {
						type: "string",
						description:
							"Desired hydration behaviour, an Avalon condition, or an Astro client:* directive.",
					},
				},
				required: ["behavior"],
			},
			handler: (args) => {
				const behavior = String(args.behavior ?? "").trim();
				if (!behavior) {
					return textResult(renderAllConditions(), false);
				}
				return textResult(resolveBehavior(behavior));
			},
		},

		{
			name: "avalon_convert_astro",
			title: "Convert Astro code to Avalon",
			description:
				"Convert an Astro code snippet to Avalon. Rewrites `client:*` hydration directives to " +
				"Avalon's `island={{ condition }}` prop and reports any other Astro-only constructs " +
				"(`.astro` files, `Astro.*` globals, `astro:actions`, `getStaticPaths`) with fixes. " +
				"Use this when porting Astro code or when you're unsure whether syntax is Astro or Avalon.",
			inputSchema: {
				type: "object",
				properties: {
					code: { type: "string", description: "The Astro code snippet to convert." },
				},
				required: ["code"],
			},
			handler: (args) => {
				const code = String(args.code ?? "");
				const converted = convertSnippet(code);
				const findings = lintForAstroisms(code);

				const parts = ["## Converted code", "", "```tsx", converted, "```"];
				if (findings.length > 0) {
					parts.push("", "## Notes & remaining Astro-isms", "");
					for (const f of findings) {
						parts.push(
							`- Line ${f.line ?? "?"}: \`${f.found}\` → ${f.suggestion}`,
							`  - ${f.reason}`,
						);
					}
				} else {
					parts.push("", "_No Astro-specific constructs detected beyond the directive rewrite._");
				}
				return textResult(parts.join("\n"));
			},
		},

		{
			name: "avalon_lint",
			title: "Lint code for Astro/Avalon confusion",
			description:
				"Scan a code snippet for Astro syntax that does NOT exist in Avalon and report each " +
				"issue with the correct Avalon replacement. Returns a clean bill of health if none found. " +
				"Run this on any Avalon page/component you write to catch mistakes like `client:load`.",
			inputSchema: {
				type: "object",
				properties: {
					code: { type: "string", description: "The code to lint." },
				},
				required: ["code"],
			},
			handler: (args) => {
				const code = String(args.code ?? "");
				const findings = lintForAstroisms(code);
				if (findings.length === 0) {
					return textResult("✅ No Astro-isms detected. This looks like valid Avalon syntax.");
				}
				const parts = [`⚠️ Found ${findings.length} issue(s):`, ""];
				for (const f of findings) {
					parts.push(`- **Line ${f.line ?? "?"}:** \`${f.found}\``);
					parts.push(`  - Fix: ${f.suggestion}`);
					parts.push(`  - Why: ${f.reason}`);
				}
				return textResult(parts.join("\n"), false);
			},
		},

		{
			name: "avalon_search_docs",
			title: "Search Avalon documentation",
			description:
				"Search Avalon's embedded documentation by keyword and return the most relevant topic(s) " +
				"as Markdown. Covers islands, hydration, server islands, actions, routing, layouts, " +
				"middleware, API routes, cron, components, and client scripts.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Keywords to search for." },
					limit: { type: "number", description: "Max topics to return (default 3)." },
				},
				required: ["query"],
			},
			handler: (args) => {
				const query = String(args.query ?? "");
				const limit = typeof args.limit === "number" ? args.limit : 3;
				const results = searchDocs(query, limit);
				if (results.length === 0) {
					const ids = DOC_TOPICS.map((t) => `\`${t.id}\``).join(", ");
					return textResult(
						`No matching topics for "${query}". Available topics: ${ids}.`,
						false,
					);
				}
				const body = results.map((t) => t.content).join("\n\n---\n\n");
				return textResult(body);
			},
		},

		{
			name: "avalon_get_doc",
			title: "Get an Avalon documentation topic",
			description:
				"Fetch the full Markdown for a specific Avalon documentation topic by id. " +
				`Valid ids: ${DOC_TOPICS.map((t) => t.id).join(", ")}.`,
			inputSchema: {
				type: "object",
				properties: {
					topic: { type: "string", description: "The topic id, e.g. 'islands-architecture'." },
				},
				required: ["topic"],
			},
			handler: (args) => {
				const topic = String(args.topic ?? "");
				const doc = getDoc(topic);
				if (!doc) {
					const ids = DOC_TOPICS.map((t) => `\`${t.id}\``).join(", ");
					return textResult(`Unknown topic "${topic}". Valid topics: ${ids}.`, false);
				}
				return textResult(doc.content);
			},
		},

		{
			name: "avalon_scaffold",
			title: "Scaffold an Avalon file",
			description:
				"Generate idiomatic Avalon boilerplate (correct imports and hydration syntax) for a " +
				`primitive. Kinds: ${SCAFFOLD_KINDS.join(", ")}. Returns the suggested file path and code.`,
			inputSchema: {
				type: "object",
				properties: {
					kind: {
						type: "string",
						enum: SCAFFOLD_KINDS,
						description: "What to scaffold.",
					},
					name: {
						type: "string",
						description: "A name for the component/action/route (default 'Example').",
					},
					condition: {
						type: "string",
						description:
							"Hydration condition for island scaffolds (default 'on:client'), e.g. 'on:visible'.",
					},
				},
				required: ["kind"],
			},
			handler: (args) => {
				const kind = String(args.kind ?? "") as ScaffoldKind;
				if (!SCAFFOLD_KINDS.includes(kind)) {
					return textResult(
						`Unknown kind "${kind}". Valid kinds: ${SCAFFOLD_KINDS.join(", ")}.`,
						true,
					);
				}
				const name = args.name ? String(args.name) : "Example";
				const condition = args.condition ? String(args.condition) : "on:client";
				const t = scaffold(kind, name, condition);
				const ext = t.suggestedPath.endsWith(".ts") ? "ts" : "tsx";
				return textResult(
					[
						`**${t.description}**`,
						"",
						`Suggested path: \`${t.suggestedPath}\``,
						"",
						`\`\`\`${ext}`,
						t.code.trimEnd(),
						"```",
					].join("\n"),
				);
			},
		},

		{
			name: "avalon_api_reference",
			title: "Avalon API & import reference",
			description:
				"Return Avalon's public API surface: the correct import paths and the symbols each " +
				"exposes (e.g. defineAction from '@useavalon/avalon/actions'). Use this to avoid inventing imports.",
			inputSchema: { type: "object", properties: {} },
			handler: () => textResult(apiReferenceMarkdown()),
		},
	];
}

function renderAllConditions(): string {
	const parts = [
		"# Avalon Hydration Conditions",
		"",
		ISLAND_PROP_REFERENCE.summary,
		"",
		"## Core conditions (no registration needed)",
		"",
		...CORE_CONDITIONS.map(conditionToMarkdown),
		"",
		"## Built-in custom directives (enable with `registerBuiltinDirectives()`)",
		"",
		...CUSTOM_DIRECTIVES.map(conditionToMarkdown),
	];
	return parts.join("\n\n");
}

function resolveBehavior(behavior: string): string {
	const lower = behavior.toLowerCase();

	// 1) Direct Astro directive?
	const astroMatch = DIRECTIVE_MAP.find((m) => lower.includes(m.astro.split("=")[0].toLowerCase()));
	if (lower.includes("client:") && astroMatch) {
		return [
			`\`${astroMatch.astro}\` is **Astro** syntax. In Avalon, use:`,
			"",
			"```tsx",
			`<Component ${astroMatch.avalon} />`,
			"```",
			"",
			astroMatch.note,
		].join("\n");
	}

	// 2) Direct condition string?
	const direct = findCondition(behavior);
	if (direct) {
		return conditionToMarkdown(direct);
	}

	// 3) Natural language mapping.
	const nl: Array<{ test: RegExp; condition: string }> = [
		{ test: /visib|scroll into|viewport|below the fold|lazy/, condition: "on:visible" },
		{ test: /click|hover|interact|tap|focus/, condition: "on:interaction" },
		{ test: /idle|low.?priority|background/, condition: "on:idle" },
		{ test: /delay|after .*second|timeout|wait/, condition: "on:delay" },
		{ test: /event|signal|when .*fires|loaded/, condition: "on:event" },
		{ test: /scroll past|scroll depth|pixel/, condition: "on:scroll" },
		{ test: /media|breakpoint|min-width|max-width|mobile|desktop/, condition: "media:<query>" },
		{ test: /immediate|right away|on load|always|asap/, condition: "on:client" },
	];
	for (const rule of nl) {
		if (rule.test.test(lower)) {
			const c = ALL_CONDITIONS.find((x) => x.condition === rule.condition);
			if (c) {
				return [`For "${behavior}", use:`, "", conditionToMarkdown(c)].join("\n");
			}
		}
	}

	// 4) Fallback: show everything + concept map hint.
	const conceptHint = CONCEPT_MAP.slice(0, 3)
		.map((c) => `- ${c.astro} → ${c.avalon}`)
		.join("\n");
	return [
		`I couldn't map "${behavior}" to a specific condition. Here are all Avalon hydration options:`,
		"",
		renderAllConditions(),
		"",
		"### Other Astro→Avalon concepts",
		conceptHint,
	].join("\n");
}
