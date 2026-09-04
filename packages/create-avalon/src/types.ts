export type Integration = "preact" | "react" | "vue" | "svelte" | "solid" | "lit" | "qwik";

/** Core rendering engine for the page/layout shell. */
export type RenderEngine = "preact" | "react";

export type StylingOption = "css-modules" | "tailwind" | "shadcn";

export type Plugin = "seo" | "agent-optimization" | "syntax-highlighting";

export type MiddlewareOption = "h3" | "hono" | "elysia";

export type DeployTarget = "cloudflare" | "netlify" | "none";

/**
 * Allowed values for each option, used to validate non-interactive CLI flags.
 * These mirror the choices offered by the interactive prompts.
 */
export const RENDER_ENGINES = ["preact", "react"] as const satisfies readonly RenderEngine[];
export const INTEGRATIONS = [
	"preact",
	"react",
	"vue",
	"svelte",
	"solid",
	"lit",
	"qwik",
] as const satisfies readonly Integration[];
export const STYLING_OPTIONS = [
	"css-modules",
	"tailwind",
	"shadcn",
] as const satisfies readonly StylingOption[];
export const PLUGINS = [
	"seo",
	"agent-optimization",
	"syntax-highlighting",
] as const satisfies readonly Plugin[];
export const MIDDLEWARE_OPTIONS = [
	"h3",
	"hono",
	"elysia",
] as const satisfies readonly MiddlewareOption[];
export const DEPLOY_TARGETS = [
	"cloudflare",
	"netlify",
	"none",
] as const satisfies readonly DeployTarget[];

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
