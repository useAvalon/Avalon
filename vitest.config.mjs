import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const wwwRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@shared": path.join(wwwRoot, "www/app/shared"),
		},
	},
	optimizeDeps: {
		include: ["zod"],
	},
	test: {
		setupFiles: ["./packages/avalon/vitest.setup.ts"],
		include: [
			"packages/avalon/src/**/tests/**/*.test.ts",
			"packages/avalon/src/**/__tests__/**/*.test.ts",
			"packages/avalon/src/**/*.test.ts",
			"packages/avalon/scripts/**/*.test.ts",
			"packages/create-avalon/src/**/*.test.ts",
			"scripts/**/*.test.ts",
			"www/src/tests/**/*.test.ts",
			"www/src/__tests__/**/*.test.ts",
			"www/app/__tests__/**/*.test.ts",
		],
		exclude: ["node_modules", "dist", ".output"],
		server: {
			deps: {
				inline: ["zod"],
			},
		},
	},
});
