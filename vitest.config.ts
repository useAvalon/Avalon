import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: ["zod"],
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/avalon/src/**/tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".output"],
    server: {
      deps: {
        inline: ["zod"],
      },
    },
  },
});
