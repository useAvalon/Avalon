import { commandsFor, packageManagerOf } from "../package-manager";
import type { Integration, ProjectConfig } from "../types";
import { INTEGRATION_PACKAGES } from "../types";
import { cloudflareProjectName } from "./deploy";

/**
 * Framework runtime dependencies each integration needs at the app level.
 * The `@useavalon/<framework>` wrapper declares these as peerDependencies, so
 * the scaffolded app must install them directly to render/hydrate that
 * framework (mirrors each integration's peerDependencies).
 */
const INTEGRATION_RUNTIME_DEPS: Record<Integration, Record<string, string>> = {
	preact: { preact: "^11.0.0", "preact-render-to-string": "^6.8.0" },
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

	// The page shell always needs its core engine, even when the user did not
	// tick that integration in the prompt.
	const selectedIntegrations = new Set<Integration>(config.integrations);
	selectedIntegrations.add(config.core);

	for (const integration of selectedIntegrations) {
		dependencies[INTEGRATION_PACKAGES[integration]] = "latest";
		Object.assign(dependencies, INTEGRATION_RUNTIME_DEPS[integration]);
	}

	if (config.plugins.includes("seo")) {
		dependencies["@useavalon/seo"] = "latest";
	}

	if (config.plugins.includes("agent-optimization")) {
		dependencies["@useavalon/agent-optimization"] = "latest";
	}

	dependencies["rehype-highlight"] = "latest";

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

	// Pin to Avalon's peer ranges. `latest` can resolve a major the published
	// package does not support (vite-imagetools 12 vs peer ^11).
	const devDependencies: Record<string, string> = {
		vite: "^8.0.0",
		typescript: "^5.0.0",
		nitro: "^3.0.260903-beta",
		"vite-imagetools": "^11.0.0",
		"@types/node": "^22.0.0",
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

	const pm = packageManagerOf(config);
	const exec = commandsFor(pm).exec;
	// Local `vite` so npm/pnpm/yarn/bun all run the same script. Bun keeps
	// `--bun` so Vite executes with the Bun runtime.
	const vite = pm === "bun" ? "bunx --bun vite" : "vite";
	const scripts: Record<string, string> = {
		dev: `${vite} dev`,
		build: "node build.mjs",
		// Nitro `node_server` listener — `vite preview` only serves `dist/` static files.
		preview: "node .output/server/index.mjs",
	};

	if (config.deploy === "cloudflare") {
		const name = cloudflareProjectName(config.projectName);
		scripts.preview = `${exec("wrangler@4")} pages dev dist`;
		scripts.deploy = `${exec("wrangler@4")} pages deploy --project-name=${name}`;
	}

	if (config.deploy === "netlify") {
		// Netlify preset writes the server under .netlify/, not .output/server.
		scripts.preview = `${exec("netlify-cli@22")} dev --offline`;
	}

	const pkg = {
		name: config.projectName,
		type: "module",
		private: true,
		scripts,
		dependencies,
		devDependencies,
	};

	return JSON.stringify(pkg, null, 2);
}
