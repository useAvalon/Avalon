export type Integration = "preact" | "react" | "vue" | "svelte" | "solid" | "lit" | "qwik";

/** Core rendering engine for the page/layout shell. */
export type RenderEngine = "preact" | "react";

export type StylingOption = "css-modules" | "tailwind" | "shadcn";

export type Plugin = "seo" | "agent-optimization" | "syntax-highlighting";

export type MiddlewareOption = "h3" | "hono" | "elysia";

export type DeployTarget = "netlify" | "none";

export interface ProjectConfig {
	projectName: string;
	/** Core rendering engine for pages/layouts. Defaults to "preact". */
	core: RenderEngine;
	integrations: Integration[];
	styling: StylingOption;
	plugins: Plugin[];
	middleware: MiddlewareOption;
	deploy: DeployTarget;
	/** Scaffold scheduled jobs (cron): an example task + `nitro.cron` config. */
	cron?: boolean;
}

export const INTEGRATION_PACKAGES: Record<Integration, string> = {
	preact: "@useavalon/preact",
	react: "@useavalon/react",
	vue: "@useavalon/vue",
	svelte: "@useavalon/svelte",
	solid: "@useavalon/solid",
	lit: "@useavalon/lit",
	qwik: "@useavalon/qwik",
};

export const BASE_DIRS = [
	"app/modules/main/pages",
	"app/modules/main/components",
	"app/modules/main/layouts",
	"app/shared/layouts",
	"app/shared/components",
	"app/shared/styles",
	"middleware",
	"routes/api",
	"public",
	"server",
] as const;
