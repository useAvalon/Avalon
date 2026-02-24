import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: ["zod"],
  },
  test: {
    include: ["packages/avalon/src/**/tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".output"],
    server: {
      deps: {
        inline: ["zod"],
      },
    },
  },
});
