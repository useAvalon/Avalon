/**
 * MCP resource definitions for the Avalon server.
 *
 * Resources let clients pull reference material into context directly. We expose
 * a directive cheat-sheet, the Astro→Avalon migration guide, the API reference,
 * and every documentation topic (via a URI template).
 *
 * @module resources
 */

import { apiReferenceMarkdown } from "./knowledge/api.ts";
import { CONCEPT_MAP, DIRECTIVE_MAP } from "./knowledge/astro-map.ts";
import {
	CORE_CONDITIONS,
	CUSTOM_DIRECTIVES,
	ISLAND_PROP_REFERENCE,
} from "./knowledge/directives.ts";
import { DOC_TOPICS, getDoc } from "./knowledge/docs.ts";
import type { ResourceDefinition, ResourceTemplateDefinition } from "./protocol/types.ts";

function directivesCheatSheet(): string {
	const rows = [...CORE_CONDITIONS, ...CUSTOM_DIRECTIVES]
		.map((c) => `| \`${c.condition}\` | ${c.summary} | ${c.takesArg ? "yes" : "—"} |`)
		.join("\n");

	const fields = ISLAND_PROP_REFERENCE.fields
		.map(
			(f) =>
				`- \`${f.name}\` (${f.required ? "required" : "optional"}${
					"default" in f && f.default ? `, default ${f.default}` : ""
				}): ${f.description}`,
		)
		.join("\n");

	const gotchas = ISLAND_PROP_REFERENCE.gotchas.map((g) => `- ${g}`).join("\n");

	return `# Avalon Hydration Directive Cheat Sheet

${ISLAND_PROP_REFERENCE.summary}

## The \`island\` prop

${fields}

\`\`\`tsx
${ISLAND_PROP_REFERENCE.canonicalExample}
\`\`\`

## Conditions

| Condition | When it hydrates | conditionArg |
|-----------|------------------|--------------|
${rows}

## Gotchas

${gotchas}

## Registering a custom directive

\`\`\`ts
${ISLAND_PROP_REFERENCE.registerCustomExample}
\`\`\`
`;
}

function astroMigrationGuide(): string {
	const directiveRows = DIRECTIVE_MAP.map(
		(m) => `| \`${m.astro}\` | \`${m.avalon}\` | ${m.note} |`,
	).join("\n");
	const conceptRows = CONCEPT_MAP.map((m) => `| ${m.astro} | ${m.avalon} | ${m.note} |`).join("\n");

	return `# Astro → Avalon Migration Guide

The most common mistake agents make is using Astro's \`client:*\` template
attributes in Avalon. Avalon has **no** \`client:*\` attributes — it uses a single
\`island={{ condition }}\` prop.

## Hydration directives

| Astro | Avalon | Note |
|-------|--------|------|
${directiveRows}

## Concepts

| Astro | Avalon | Note |
|-------|--------|------|
${conceptRows}
`;
}

/** Static resources exposed by the server. */
export function createResources(): ResourceDefinition[] {
	return [
		{
			uri: "avalon://directives",
			name: "avalon-directives",
			title: "Avalon Hydration Directive Cheat Sheet",
			description:
				"The `island` prop, every hydration condition, gotchas, and how to register custom directives.",
			mimeType: "text/markdown",
			read: directivesCheatSheet,
		},
		{
			uri: "avalon://astro-migration",
			name: "avalon-astro-migration",
			title: "Astro → Avalon Migration Guide",
			description: "Mapping of Astro directives/concepts to their Avalon equivalents.",
			mimeType: "text/markdown",
			read: astroMigrationGuide,
		},
		{
			uri: "avalon://api",
			name: "avalon-api-reference",
			title: "Avalon Public API Reference",
			description: "Correct import paths and exported symbols.",
			mimeType: "text/markdown",
			read: apiReferenceMarkdown,
		},
		{
			uri: "avalon://docs",
			name: "avalon-docs-index",
			title: "Avalon Documentation Index",
			description: "List of all embedded documentation topics.",
			mimeType: "text/markdown",
			read: () =>
				[
					"# Avalon Documentation Topics",
					"",
					...DOC_TOPICS.map((t) => `- \`avalon://docs/${t.id}\` — ${t.title}`),
				].join("\n"),
		},
	];
}

/** Templated resources: one Markdown doc per topic. */
export function createResourceTemplates(): ResourceTemplateDefinition[] {
	return [
		{
			uriTemplate: "avalon://docs/{topic}",
			name: "avalon-doc-topic",
			title: "Avalon Documentation Topic",
			description: "Full Markdown for a single documentation topic.",
			mimeType: "text/markdown",
			read: (uri) => {
				const match = /^avalon:\/\/docs\/(.+)$/.exec(uri);
				if (!match) return null;
				const doc = getDoc(match[1]);
				return doc ? doc.content : null;
			},
		},
	];
}
