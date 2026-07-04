import type { Integration, ProjectConfig } from "../types";
import { INTEGRATION_PACKAGES } from "../types";

/**
 * Framework runtime dependencies each integration needs at the app level.
 * The `@useavalon/<framework>` wrapper declares these as peerDependencies, so
 * the scaffolded app must install them directly to render/hydrate that
 * framework (mirrors each integration's peerDependencies).
 */
const INTEGRATION_RUNTIME_DEPS: Record<Integration, Record<string, string>> = {
	preact: { preact: "^10.0.0", "preact-render-to-string": "^6.0.0" },
	react: { react: "^19.0.0", "react-dom": "^19.0.0" },
	vue: { vue: "^3.4.0" },
	svelte: { svelte: "^5.0.0" },
	solid: { "solid-js": "^1.8.0" },
	lit: {
		lit: "^3.0.0",
		"@lit-labs/ssr": "^4.0.0",
		"@lit-labs/ssr-client": "^1.0.0",
		"@lit-labs/ssr-dom-shim": "^1.0.0",
	},
	qwik: { "@builder.io/qwik": "^1.5.0" },
};

export function generatePackageJson(config: ProjectConfig): string {
	const dependencies: Record<string, string> = {
		"@useavalon/avalon": "latest",
	};

	for (const integration of config.integrations) {
		dependencies[INTEGRATION_PACKAGES[integration]] = "latest";
		Object.assign(dependencies, INTEGRATION_RUNTIME_DEPS[integration]);
	}

	if (config.plugins.includes("seo")) {
		dependencies["@useavalon/seo"] = "latest";
	}

	if (config.plugins.includes("agent-optimization")) {
		dependencies["@useavalon/agent-optimization"] = "latest";
	}

	if (config.plugins.includes("syntax-highlighting")) {
		dependencies["rehype-highlight"] = "latest";
	}

	// Middleware dependencies
	switch (config.middleware) {
		case "hono":
			dependencies.hono = "latest";
			break;
		case "elysia":
			dependencies.elysia = "latest";
			break;
		// h3 is included via nitro, no extra dep needed
	}

	// Styling dependencies
	const devDependencies: Record<string, string> = {
		vite: "latest",
		typescript: "latest",
		nitro: "latest",
		"vite-imagetools": "latest",
	};

	switch (config.styling) {
		case "tailwind":
			devDependencies.tailwindcss = "latest";
			devDependencies["@tailwindcss/vite"] = "latest";
			break;
		case "shadcn":
			devDependencies.tailwindcss = "latest";
			devDependencies["@tailwindcss/vite"] = "latest";
			dependencies["@shadcn/ui"] = "latest";
			dependencies["tailwind-merge"] = "^3.5.0";
			dependencies.clsx = "^2.1.1";
			break;
	}

	const pkg = {
		name: config.projectName,
		type: "module",
		private: true,
		scripts: {
			dev: "bunx --bun vite dev",
			build: "node build.mjs",
			preview: "node .output/server/index.mjs",
		},
		dependencies,
		devDependencies,
	};

	return JSON.stringify(pkg, null, 2);
}
