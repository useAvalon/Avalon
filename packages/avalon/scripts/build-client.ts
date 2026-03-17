/**
 * Pre-compile client-side TypeScript files to JavaScript.
 *
 * Vite 8's OXC transform applies the global `jsx` config (set by integration
 * plugins like @preact/preset-vite) to ALL files it processes. Plain `.ts`
 * files fail with "Invalid jsx option: 'automatic'". Plugin `transform` hooks
 * don't fire for `node_modules` files on the client side in Vite 8.
 *
 * Solution: ship pre-compiled `.js` files for client code. OXC's default
 * exclude is `/\.js$/`, so these files pass through untouched.
 *
 * Usage: bun run scripts/build-client.ts
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { transform } from "oxc-transform";

const CLIENT_DIR = join(import.meta.dir, "..", "src", "client");

async function collectTSFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip tests and types directories
      if (entry.name === "tests" || entry.name === "types") continue;
      files.push(...(await collectTSFiles(fullPath)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function buildClient() {
  const tsFiles = await collectTSFiles(CLIENT_DIR);

  console.log(`Compiling ${tsFiles.length} client files...`);

  for (const file of tsFiles) {
    const code = await readFile(file, "utf-8");
    const rel = relative(CLIENT_DIR, file);

    const result = await transform(file, code, {
      sourcemap: false,
      typescript: { onlyRemoveTypeImports: false },
    });

    // Rewrite .ts imports to .js so the browser loads pre-compiled files
    let rewritten = result.code.replace(
      /(from\s+['"])([^'"]+)\.ts(['"])/g,
      "$1$2.js$3"
    );
    // Also rewrite dynamic import('.../something.ts') patterns
    rewritten = rewritten.replace(
      /(import\s*\(\s*['"])([^'"]+)\.ts(['"]\s*\))/g,
      "$1$2.js$3"
    );

    const jsPath = file.replace(/\.ts$/, ".js");
    await writeFile(jsPath, rewritten, "utf-8");

    console.log(`  ✓ ${rel} → ${rel.replace(/\.ts$/, ".js")}`);
  }

  console.log("Done.");
}

buildClient().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
