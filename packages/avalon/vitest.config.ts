import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["./vitest.setup.ts"],
		server: {
			deps: {
				inline: ["zod"],
			},
		},
	},
});
