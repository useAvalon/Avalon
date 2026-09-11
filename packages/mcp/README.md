# @useavalon/mcp

A **Model Context Protocol (MCP)** server for the [Avalon Framework](https://useavalon.dev).

It gives AI coding agents authoritative, machine-readable knowledge about Avalon
so they stop reaching for **Astro** syntax. The number-one mistake agents make
with Avalon is using Astro's `client:*` template attributes. Avalon has none of
those — hydration is controlled by a single `island` prop:

```tsx
// ❌ Astro (does NOT work in Avalon)
<Counter client:visible />

// ✅ Avalon
<Counter island={{ condition: 'on:visible' }} />
```

This server exposes tools, resources, and prompts that make that distinction
impossible to miss.

## Why

Avalon and Astro both use an islands architecture, so models trained on lots of
Astro code confidently emit `client:load`, `Astro.props`, `.astro` files, and
`getStaticPaths()` — none of which exist in Avalon. This MCP server lets an agent
look up the correct syntax, convert Astro snippets, and lint its own output
before writing files.

## Features

### Tools

| Tool                         | What it does                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avalon_hydration_directive` | Given a behaviour (`"when visible"`), an Avalon condition (`on:idle`), or an Astro directive (`client:load`), returns the correct `island` prop syntax. |
| `avalon_convert_astro`       | Rewrites `client:*` directives to `island={{ condition }}` and flags other Astro-only constructs.                                                       |
| `avalon_lint`                | Scans a snippet for Astro-isms that don't exist in Avalon and suggests fixes.                                                                           |
| `avalon_search_docs`         | Keyword search across the embedded Avalon docs.                                                                                                         |
| `avalon_get_doc`             | Fetch a full documentation topic by id.                                                                                                                 |
| `avalon_scaffold`            | Generate idiomatic boilerplate (page, island, action, layout, api-route, cron-job, custom-directive, …).                                                |
| `avalon_api_reference`       | Correct import paths and exported symbols.                                                                                                              |

### Resources

- `avalon://directives` — hydration directive cheat sheet
- `avalon://astro-migration` — Astro → Avalon mapping
- `avalon://api` — public API reference
- `avalon://docs` — documentation index
- `avalon://docs/{topic}` — a single documentation topic (templated)

Documentation topics cover: overview, islands (incl. framework file-naming), hydration strategies, server islands, server actions, routing (module-based + flat), client navigation (clientRouter, persist, prefetch, View Transitions), layouts, middleware, API routes, cron jobs, built-in components, state & cross-island communication, client scripts, styling, metadata/SEO, MDX, configuration, framework integrations, the CLI (create-avalon/avalon), and the Flora grid system.

All tools are annotated `readOnlyHint: true` — they are pure knowledge lookups with no side effects, so agents can call them freely.

### Prompts

- `avalon_island` — build an island with correct hydration
- `avalon_review` — review code for Astro/Avalon confusion
- `avalon_migrate_from_astro` — migrate an Astro file to Avalon

## The core difference: hydration

Avalon uses one prop, `island`, on an imported component:

```tsx
import Counter from "../islands/Counter.tsx";

<Counter island={{ condition: "on:visible" }} />;
```

| Astro                | Avalon                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `client:load`        | `island={{ condition: 'on:client' }}`                            |
| `client:visible`     | `island={{ condition: 'on:visible' }}`                           |
| `client:idle`        | `island={{ condition: 'on:idle' }}`                              |
| `client:media={"…"}` | `island={{ condition: 'media:…' }}`                              |
| `client:only`        | `island={{ condition: 'on:client' }}` (Avalon always SSRs first) |

Avalon also supports interaction-based (`on:interaction`) and custom directives
(`on:delay`, `on:event`, `on:scroll`, `on:match`) with an optional `conditionArg`.

## Usage

The server communicates over **stdio** using JSON-RPC 2.0 and has **zero runtime
dependencies**.

### Run from source (inside this monorepo)

```bash
bun run --filter @useavalon/mcp start
# or, from packages/mcp:
bun run bin/avalon-mcp.ts
```

### MCP client configuration

Most clients accept a command + args. Point them at the binary.

**Claude Desktop / Claude Code** (`claude_desktop_config.json` or `.mcp.json`):

```json
{
	"mcpServers": {
		"avalon": {
			"command": "bun",
			"args": ["run", "/absolute/path/to/Avalon/packages/mcp/bin/avalon-mcp.ts"]
		}
	}
}
```

**After publishing** (`npm i -g @useavalon/mcp` or via `npx`):

```json
{
	"mcpServers": {
		"avalon": {
			"command": "npx",
			"args": ["-y", "@useavalon/mcp"]
		}
	}
}
```

The binary is named `avalon-mcp`.

### Quick manual smoke test

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"avalon_lint","arguments":{"code":"<C client:load />"}}}' \
  | bun run bin/avalon-mcp.ts
```

## Programmatic use

The knowledge base and server are also importable:

```ts
import { createAvalonMcpServer, convertSnippet, lintForAstroisms } from "@useavalon/mcp";

lintForAstroisms("<C client:load />");
// → [{ found: 'client:load', suggestion: "island={{ condition: 'on:client' }}", … }]
```

## Development

```bash
bun run --filter @useavalon/mcp test   # vitest
bun run build                          # compile to dist/ (publish)
```

## License

MIT
