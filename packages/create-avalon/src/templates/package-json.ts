import { commandsFor, packageManagerOf } from "../package-manager";
import {
	AGENT_OPTIMIZATION_VERSION,
	avalonReleaseRange,
	INTEGRATION_PACKAGE_VERSIONS,
	THIRD_PARTY_VERSIONS,
} from "../template-versions";
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
	preact: {
		preact: THIRD_PARTY_VERSIONS.preact,
		"preact-render-to-string": THIRD_PARTY_VERSIONS["preact-render-to-string"],
	},
	react: { react: THIRD_PARTY_VERSIONS.react, "react-dom": THIRD_PARTY_VERSIONS["react-dom"] },
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

/** Version range for an `@useavalon/<integration>` wrapper. */
function integrationPackageVersion(integration: Integration): string {
	if (integration === "preact") return avalonReleaseRange();
	return INTEGRATION_PACKAGE_VERSIONS[integration];
}

export function generatePackageJson(config: ProjectConfig): string {
	const avalonRange = avalonReleaseRange();
	const dependencies: Record<string, string> = {
		"@useavalon/avalon": avalonRange,
	};

	// The page shell always needs its core engine, even when the user did not
	// tick that integration in the prompt.
	const selectedIntegrations = new Set<Integration>(config.integrations);
	selectedIntegrations.add(config.core);

	for (const integration of selectedIntegrations) {
		dependencies[INTEGRATION_PACKAGES[integration]] = integrationPackageVersion(integration);
		Object.assign(dependencies, INTEGRATION_RUNTIME_DEPS[integration]);
	}

	if (config.plugins.includes("seo")) {
		dependencies["@useavalon/seo"] = avalonRange;
	}

	if (config.plugins.includes("agent-optimization")) {
		dependencies["@useavalon/agent-optimization"] = AGENT_OPTIMIZATION_VERSION;
	}

	dependencies["rehype-highlight"] = THIRD_PARTY_VERSIONS["rehype-highlight"];

	// Middleware dependencies
	switch (config.middleware) {
		case "hono":
			dependencies.hono = THIRD_PARTY_VERSIONS.hono;
			break;
		case "elysia":
			dependencies.elysia = THIRD_PARTY_VERSIONS.elysia;
			break;
		// h3 is included via nitro, no extra dep needed
	}

	// Versions tested with this Avalon release (see template-versions.ts).
	// `latest` can resolve a release the published package does not support
	// (vite-imagetools 12 vs peer ^11).
	const devDependencies: Record<string, string> = {
		vite: THIRD_PARTY_VERSIONS.vite,
		typescript: "^5.0.0",
		nitro: THIRD_PARTY_VERSIONS.nitro,
		"vite-imagetools": "^11.0.0",
		"@types/node": "^22.0.0",
	};

	switch (config.styling) {
		case "tailwind":
			devDependencies.tailwindcss = THIRD_PARTY_VERSIONS.tailwindcss;
			devDependencies["@tailwindcss/vite"] = THIRD_PARTY_VERSIONS["@tailwindcss/vite"];
			break;
		case "shadcn":
			devDependencies.tailwindcss = THIRD_PARTY_VERSIONS.tailwindcss;
			devDependencies["@tailwindcss/vite"] = THIRD_PARTY_VERSIONS["@tailwindcss/vite"];
			dependencies["@shadcn/ui"] = THIRD_PARTY_VERSIONS["@shadcn/ui"];
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

	const pkg: Record<string, unknown> = {
		name: config.projectName,
		type: "module",
		private: true,
		scripts,
		dependencies,
		devDependencies,
	};

	// Corepack pin so Netlify (and other hosts) use Berry instead of Yarn Classic.
	if (pm === "yarn" && config.packageManagerVersion) {
		pkg.packageManager = `yarn@${config.packageManagerVersion}`;
	}

	return JSON.stringify(pkg, null, 2);
}
