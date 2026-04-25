import type { ProjectConfig } from "../types";
import { INTEGRATION_PACKAGES } from "../types";

export function generatePackageJson(config: ProjectConfig): string {
	const dependencies: Record<string, string> = {
		"@useavalon/avalon": "latest",
	};

	for (const integration of config.integrations) {
		dependencies[INTEGRATION_PACKAGES[integration]] = "latest";
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
