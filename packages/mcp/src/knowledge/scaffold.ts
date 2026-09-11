/**
 * Boilerplate generators for common Avalon primitives.
 *
 * Each template is written in idiomatic Avalon (correct imports, correct
 * hydration syntax) so agents produce working code instead of Astro-flavoured
 * guesses.
 *
 * @module knowledge/scaffold
 */

export type ScaffoldKind =
	| "page"
	| "dynamic-page"
	| "island"
	| "island-usage"
	| "server-island"
	| "action"
	| "layout"
	| "api-route"
	| "middleware"
	| "cron-job"
	| "custom-directive";

export interface ScaffoldTemplate {
	kind: ScaffoldKind;
	/** Suggested file path relative to the project root. */
	suggestedPath: string;
	/** Short description of what this scaffolds. */
	description: string;
	/** The generated code. */
	code: string;
}

const toPascal = (name: string): string =>
	name
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join("") || "Component";

const toKebab = (name: string): string =>
	name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.toLowerCase()
		.replace(/^-+|-+$/g, "") || "example";

function isClientOnlyCondition(condition: string): boolean {
	const normalized = condition.trim().replaceAll(/\s+/g, "").toLowerCase();
	return (
		normalized === "clientonly" || normalized === "client:only" || normalized === "client-only"
	);
}

function islandUsageProp(condition: string): string {
	if (isClientOnlyCondition(condition)) {
		return "island={{ clientOnly: true }}";
	}
	return `island={{ condition: '${condition}' }}`;
}

function islandUsageDescription(name: string, condition: string): string {
	if (isClientOnlyCondition(condition)) {
		return `Using the ${name} island as client-only (no SSR, mount in the browser).`;
	}
	return `Using the ${name} island with the '${condition}' hydration condition.`;
}

/**
 * Generate a scaffold for the requested primitive.
 *
 * @param kind - What to scaffold.
 * @param name - A human name (component, action, or route name).
 * @param condition - Hydration condition for island scaffolds (default on:client).
 */
export function scaffold(
	kind: ScaffoldKind,
	name = "Example",
	condition = "on:client",
): ScaffoldTemplate {
	const Pascal = toPascal(name);
	const kebab = toKebab(name);

	switch (kind) {
		case "page":
			return {
				kind,
				suggestedPath: `app/modules/main/pages/${kebab}.tsx`,
				description: "A static server-rendered page.",
				code: `export const frontmatter = {
  title: '${Pascal}',
  description: 'A ${Pascal} page.',
};

export default function ${Pascal}Page() {
  return (
    <section>
      <h1>${Pascal}</h1>
    </section>
  );
}
`,
			};

		case "dynamic-page":
			return {
				kind,
				suggestedPath: `app/modules/main/pages/${kebab}/[slug].tsx`,
				description: "A dynamic route reading a param from the H3 event.",
				code: `import type { H3Event } from 'h3';

export default function ${Pascal}Detail({ event }: { event: H3Event }) {
  const slug = event.context.params?.slug;
  return (
    <article>
      <h1>${Pascal}: {slug}</h1>
    </article>
  );
}
`,
			};

		case "island":
			return {
				kind,
				suggestedPath: `app/modules/main/components/${Pascal}.tsx`,
				description:
					"An interactive Preact island component (a plain .tsx is Preact; name it *.react.tsx for React).",
				code: `/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function ${Pascal}({ initialCount = 0 }: { initialCount?: number }) {
  const [count, setCount] = useState(initialCount);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}
`,
			};

		case "island-usage":
			return {
				kind,
				suggestedPath: `app/modules/main/pages/index.tsx`,
				description: islandUsageDescription(Pascal, condition),
				code: `import ${Pascal} from '../components/${Pascal}.tsx';

export default function Page() {
  return (
    <div>
      {/* Avalon controls hydration via the island prop — NOT client:* attributes */}
      <${Pascal} ${islandUsageProp(condition)} initialCount={5} />
    </div>
  );
}
`,
			};

		case "server-island":
			return {
				kind,
				suggestedPath: `app/modules/main/pages/dashboard.tsx`,
				description: `Rendering ${Pascal} as a server island with a fallback.`,
				code: `import ${Pascal} from '../components/${Pascal}.tsx';

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <${Pascal}
        server={{ fallback: <div aria-busy="true">Loading…</div> }}
        userId={/* server context */ 'current-user'}
      />
    </div>
  );
}
`,
			};

		case "action":
			return {
				kind,
				suggestedPath: `app/actions/index.ts`,
				description: "A type-safe server action with Zod validation.",
				code: `import { defineAction, ActionError } from '@useavalon/avalon/actions';
import { z } from 'zod';

export const server = {
  ${kebab.replace(/-/g, "_")}: defineAction({
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }, ctx) => {
      if (!ctx.cookies.get('session')) {
        throw new ActionError({ code: 'UNAUTHORIZED' });
      }
      return { message: \`Hello, \${name}!\` };
    },
  }),
};

// Call from the client:
//   import { actions } from 'virtual:avalon/actions';
//   const { data, error } = await actions.${kebab.replace(/-/g, "_")}({ name: 'World' });
`,
			};

		case "layout":
			return {
				kind,
				suggestedPath: `app/shared/layouts/_layout.tsx`,
				description: "A root layout using LayoutProps.",
				code: `import type { LayoutProps } from '@useavalon/avalon';

export default function RootLayout({ children, frontmatter }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{frontmatter?.title ?? 'My Site'}</title>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
`,
			};

		case "api-route":
			return {
				kind,
				suggestedPath: `routes/api/${kebab}.ts`,
				description: "A Nitro API route handler.",
				code: `export default defineEventHandler(async (event) => {
  if (event.method === 'POST') {
    const body = await readBody(event);
    return { created: body };
  }
  return { message: 'Hello from /api/${kebab}' };
});
`,
			};

		case "middleware":
			return {
				kind,
				suggestedPath: `app/modules/main/pages/${kebab}/_middleware.ts`,
				description: "Scoped middleware guarding a route subtree.",
				code: `import type { H3Event } from 'h3';

export default async (event: H3Event) => {
  const token = event.req.headers.get('Authorization');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Attach data for downstream handlers
  event.context.user = { token };
};
`,
			};

		case "cron-job":
			return {
				kind,
				suggestedPath: `tasks/${kebab}.ts`,
				description: "A scheduled cron job (Nitro task).",
				code: `import { defineCronJob } from '@useavalon/avalon/cron';

export default defineCronJob({
  meta: { description: '${Pascal} scheduled job' },
  async run({ payload }) {
    // ...do work...
    return { result: 'ok' };
  },
});

// Schedule in your Vite config:
//   avalon({ nitro: { cron: [{ schedule: '0 * * * *', handler: 'tasks/${kebab}.ts' }] } });
`,
			};

		case "custom-directive":
			return {
				kind,
				suggestedPath: `server/renderer.ts`,
				description: "Registering a custom hydration directive.",
				code: `import { registerHydrationDirective } from '@useavalon/avalon';

registerHydrationDirective('on:${kebab}', {
  name: 'on:${kebab}',
  // Runs on the client. Call hydrate() exactly once.
  script: (el, hydrate, arg) => {
    // Example: hydrate after a delay from conditionArg
    setTimeout(hydrate, Number.parseInt(arg || '1000', 10));
  },
});

export { default } from 'virtual:avalon/renderer';

// Use it:  <Widget island={{ condition: 'on:${kebab}', conditionArg: '2000' }} />
`,
			};

		default:
			throw new Error(`Unknown scaffold kind: ${kind}`);
	}
}

/** All supported scaffold kinds (for tool schemas / listing). */
export const SCAFFOLD_KINDS: ScaffoldKind[] = [
	"page",
	"dynamic-page",
	"island",
	"island-usage",
	"server-island",
	"action",
	"layout",
	"api-route",
	"middleware",
	"cron-job",
	"custom-directive",
];
