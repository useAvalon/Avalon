/**
 * Tests for Island Discovery System
 * 
 * Verifies the core discovery functionality for nested islands support.
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { join, resolve } from "jsr:@std/path";
import { ensureDir } from "jsr:@std/fs";
import {
  discoverIslandDirectories,
  discoverIslandsInDirectory,
  discoverAllIslands,
  getQualifiedIslandName,
  parseQualifiedIslandName,
} from "../scanner.ts";
import { IslandRegistry, createIslandRegistry } from "../registry.ts";
import { IslandResolver, createIslandResolver } from "../resolver.ts";
import type { IslandDirectory, DiscoveredIsland } from "../types.ts";

// Test fixtures directory
const TEST_DIR = resolve("./test-islands-discovery-temp");

async function setupTestDirectory(): Promise<void> {
  // Clean up if exists
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }

  // Create test directory structure
  await ensureDir(join(TEST_DIR, "src", "islands"));
  await ensureDir(join(TEST_DIR, "src", "modules", "auth", "islands"));
  await ensureDir(join(TEST_DIR, "src", "modules", "dashboard", "islands"));
  await ensureDir(join(TEST_DIR, "src", "features", "blog", "islands"));
}

async function cleanupTestDirectory(): Promise<void> {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

async function createTestIsland(
  relativePath: string,
  content = "export default function Component() { return null; }"
): Promise<void> {
  const filePath = join(TEST_DIR, relativePath);
  await Deno.writeTextFile(filePath, content);
}

// ============================================================================
// Scanner Tests
// ============================================================================

Deno.test("Island Discovery - discovers default islands directory", async () => {
  await setupTestDirectory();
  try {
    const directories = await discoverIslandDirectories(TEST_DIR);
    
    // Should find the default islands directory
    const defaultDir = directories.find(d => d.isDefault);
    assertExists(defaultDir);
    assertEquals(defaultDir!.relativePath, "islands");
    assertEquals(defaultDir!.namespace, "");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - discovers nested islands directories", async () => {
  await setupTestDirectory();
  try {
    const directories = await discoverIslandDirectories(TEST_DIR);
    
    // Should find all islands directories
    assertEquals(directories.length, 4);
    
    // Check namespaces
    const namespaces = directories.map(d => d.namespace).sort();
    assertEquals(namespaces, ["", "features/blog", "modules/auth", "modules/dashboard"]);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - default directory has highest priority", async () => {
  await setupTestDirectory();
  try {
    const directories = await discoverIslandDirectories(TEST_DIR);
    
    // Default directory should be first
    assertEquals(directories[0].isDefault, true);
    assertEquals(directories[0].relativePath, "islands");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - discovers island files in directory", async () => {
  await setupTestDirectory();
  try {
    // Create test island files
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/islands/Button.tsx");
    await createTestIsland("src/islands/Card.vue");
    
    const directories = await discoverIslandDirectories(TEST_DIR);
    const defaultDir = directories.find(d => d.isDefault)!;
    
    const islands = await discoverIslandsInDirectory(defaultDir, TEST_DIR);
    
    assertEquals(islands.length, 3);
    
    const names = islands.map(i => i.name).sort();
    assertEquals(names, ["Button", "Card", "Counter"]);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - detects framework from file extension", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/PreactCounter.tsx");
    await createTestIsland("src/islands/VueCounter.vue");
    await createTestIsland("src/islands/SvelteCounter.svelte");
    await createTestIsland("src/islands/SolidCounter.solid.tsx");
    await createTestIsland("src/islands/LitCounter.lit.ts");
    
    const directories = await discoverIslandDirectories(TEST_DIR);
    const defaultDir = directories.find(d => d.isDefault)!;
    const islands = await discoverIslandsInDirectory(defaultDir, TEST_DIR);
    
    const frameworks = new Map(islands.map(i => [i.name, i.framework]));
    
    assertEquals(frameworks.get("PreactCounter"), "preact");
    assertEquals(frameworks.get("VueCounter"), "vue");
    assertEquals(frameworks.get("SvelteCounter"), "svelte");
    assertEquals(frameworks.get("SolidCounter"), "solid");
    assertEquals(frameworks.get("LitCounter"), "lit");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - discovers all islands across directories", async () => {
  await setupTestDirectory();
  try {
    // Create islands in different directories
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/LoginForm.tsx");
    await createTestIsland("src/modules/dashboard/islands/Chart.tsx");
    await createTestIsland("src/features/blog/islands/PostCard.tsx");
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    
    assertEquals(allIslands.length, 4);
    
    const names = allIslands.map(i => i.name).sort();
    assertEquals(names, ["Chart", "Counter", "LoginForm", "PostCard"]);
  } finally {
    await cleanupTestDirectory();
  }
});

// ============================================================================
// Qualified Name Tests
// ============================================================================

Deno.test("Island Discovery - qualified name for default directory", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    const counter = allIslands.find(i => i.name === "Counter")!;
    
    const qualifiedName = getQualifiedIslandName(counter);
    assertEquals(qualifiedName, "Counter");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - qualified name for nested directory", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/modules/auth/islands/LoginForm.tsx");
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    const loginForm = allIslands.find(i => i.name === "LoginForm")!;
    
    const qualifiedName = getQualifiedIslandName(loginForm);
    assertEquals(qualifiedName, "modules/auth/LoginForm");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - parse qualified name", () => {
  // Simple name
  let result = parseQualifiedIslandName("Counter");
  assertEquals(result.namespace, "");
  assertEquals(result.name, "Counter");
  
  // Qualified name
  result = parseQualifiedIslandName("modules/auth/LoginForm");
  assertEquals(result.namespace, "modules/auth");
  assertEquals(result.name, "LoginForm");
  
  // Deeply nested
  result = parseQualifiedIslandName("features/blog/posts/PostCard");
  assertEquals(result.namespace, "features/blog/posts");
  assertEquals(result.name, "PostCard");
});

// ============================================================================
// Registry Tests
// ============================================================================

Deno.test("Island Registry - registers and resolves islands", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/LoginForm.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    
    assertEquals(registry.size, 2);
    
    // Resolve by name
    const counter = registry.resolve("Counter");
    assertExists(counter);
    assertEquals(counter!.name, "Counter");
    
    // Resolve by qualified name
    const loginForm = registry.resolve("modules/auth/LoginForm");
    assertExists(loginForm);
    assertEquals(loginForm!.name, "LoginForm");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Registry - detects collisions", async () => {
  await setupTestDirectory();
  try {
    // Create islands with same name in different directories
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/Counter.tsx");
    await createTestIsland("src/modules/dashboard/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const collisions = registry.detectCollisions();
    
    assertEquals(collisions.length, 1);
    assertEquals(collisions[0].name, "Counter");
    assertEquals(collisions[0].islands.length, 3);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Registry - resolves collisions with priority", async () => {
  await setupTestDirectory();
  try {
    // Create islands with same name
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    
    // Default directory should win
    const counter = registry.resolve("Counter");
    assertExists(counter);
    assertEquals(counter!.directory.isDefault, true);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Registry - finds all islands by name", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const matches = registry.findByName("Counter");
    
    assertEquals(matches.length, 2);
  } finally {
    await cleanupTestDirectory();
  }
});

// ============================================================================
// Resolver Tests
// ============================================================================

Deno.test("Island Resolver - resolves by name", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const result = resolver.resolve("Counter");
    assertExists(result);
    assertEquals(result!.island.name, "Counter");
    assertEquals(result!.ambiguous, false);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Resolver - resolves by qualified name", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/modules/auth/islands/LoginForm.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const result = resolver.resolve("modules/auth/LoginForm");
    assertExists(result);
    assertEquals(result!.island.name, "LoginForm");
    assertEquals(result!.island.namespace, "modules/auth");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Resolver - marks ambiguous resolutions", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const result = resolver.resolve("Counter");
    assertExists(result);
    assertEquals(result!.ambiguous, true);
    assertExists(result!.alternatives);
    assertEquals(result!.alternatives!.length, 1);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Resolver - generates import paths", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const result = resolver.resolve("Counter");
    assertExists(result);
    
    // Import path should be relative
    assert(result!.importPath.includes("Counter.tsx"));
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Resolver - suggests qualified names for disambiguation", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/modules/auth/islands/Counter.tsx");
    
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const suggestions = resolver.suggestQualifiedNames("Counter");
    
    assertEquals(suggestions.length, 2);
    assert(suggestions.includes("Counter"));
    assert(suggestions.includes("modules/auth/Counter"));
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Resolver - provides resolution order documentation", async () => {
  await setupTestDirectory();
  try {
    const registry = await createIslandRegistry(TEST_DIR);
    const resolver = createIslandResolver(registry, TEST_DIR);
    
    const order = resolver.getResolutionOrder();
    
    assert(order.length > 0);
    assert(order.some(line => line.includes("default")));
  } finally {
    await cleanupTestDirectory();
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("Island Discovery - handles empty directories", async () => {
  await setupTestDirectory();
  try {
    // Don't create any island files
    const allIslands = await discoverAllIslands(TEST_DIR);
    assertEquals(allIslands.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - handles nonexistent directory", async () => {
  const nonexistentDir = "/tmp/nonexistent_islands_" + Date.now();
  
  const directories = await discoverIslandDirectories(nonexistentDir);
  assertEquals(directories.length, 0);
});

Deno.test("Island Discovery - ignores unsupported file extensions", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx");
    await createTestIsland("src/islands/styles.css", "/* CSS */");
    await createTestIsland("src/islands/README.md", "# README");
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    
    // Should only find the .tsx file
    assertEquals(allIslands.length, 1);
    assertEquals(allIslands[0].name, "Counter");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Discovery - excludes node_modules", async () => {
  await setupTestDirectory();
  try {
    // Create islands in node_modules (should be excluded)
    await ensureDir(join(TEST_DIR, "src", "node_modules", "some-package", "islands"));
    await createTestIsland("src/node_modules/some-package/islands/Counter.tsx");
    
    // Create a valid island
    await createTestIsland("src/islands/Button.tsx");
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    
    // Should only find Button, not the one in node_modules
    assertEquals(allIslands.length, 1);
    assertEquals(allIslands[0].name, "Button");
  } finally {
    await cleanupTestDirectory();
  }
});


// ============================================================================
// Validator Tests
// ============================================================================

import {
  IslandValidator,
  createIslandValidator,
  validateAllIslands,
  formatValidationError,
  formatValidationWarning,
  formatCircularDependency,
  formatValidationResult,
} from "../validator.ts";

Deno.test("Island Validator - validates valid component", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx", `
      export default function Counter() {
        return <div>Counter</div>;
      }
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/Counter.tsx");
    const result = await validator.validateComponent(filePath);
    
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - detects missing export", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/NoExport.tsx", `
      function NoExport() {
        return <div>No Export</div>;
      }
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/NoExport.tsx");
    const result = await validator.validateComponent(filePath);
    
    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
    assertEquals(result.errors[0].type, "invalid-export");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - validates Vue component", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/VueCounter.vue", `
      <template>
        <div>{{ count }}</div>
      </template>
      <script setup>
        import { ref } from 'vue';
        const count = ref(0);
      </script>
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/VueCounter.vue");
    const result = await validator.validateComponent(filePath);
    
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - validates Svelte component", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/SvelteCounter.svelte", `
      <script>
        let count = 0;
      </script>
      <button on:click={() => count++}>{count}</button>
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/SvelteCounter.svelte");
    const result = await validator.validateComponent(filePath);
    
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - warns on lowercase component name", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/counter.tsx", `
      export default function counter() {
        return <div>Counter</div>;
      }
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/counter.tsx");
    const result = await validator.validateComponent(filePath);
    
    // Should pass but with warning
    assertEquals(result.valid, true);
    assertEquals(result.warnings.length, 1);
    assertEquals(result.warnings[0].type, "deprecated-pattern");
    assert(result.warnings[0].message.includes("PascalCase"));
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - validates Lit component", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/LitCounter.lit.ts", `
      import { LitElement, html } from 'lit';
      import { customElement } from 'lit/decorators.js';
      
      @customElement('lit-counter')
      export class LitCounter extends LitElement {
        render() {
          return html\`<div>Counter</div>\`;
        }
      }
    `);
    
    const validator = createIslandValidator(TEST_DIR);
    const filePath = join(TEST_DIR, "src/islands/LitCounter.lit.ts");
    const result = await validator.validateComponent(filePath);
    
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - validates directory with empty warning", async () => {
  await setupTestDirectory();
  try {
    const directories = await discoverIslandDirectories(TEST_DIR);
    const defaultDir = directories.find(d => d.isDefault)!;
    
    const validator = createIslandValidator(TEST_DIR);
    const result = await validator.validateDirectory(defaultDir);
    
    assertEquals(result.valid, true);
    assertEquals(result.warnings.length, 1);
    assertEquals(result.warnings[0].type, "empty-directory");
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - validates naming convention", () => {
  const validator = createIslandValidator("/tmp");
  
  // Valid PascalCase
  let result = validator.validateNamingConvention("Counter", "/tmp/Counter.tsx");
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.warnings.length, 0);
  
  // Valid PascalCase with numbers
  result = validator.validateNamingConvention("Counter2", "/tmp/Counter2.tsx");
  assertEquals(result.valid, true);
  
  // Invalid - lowercase
  result = validator.validateNamingConvention("counter", "/tmp/counter.tsx");
  assertEquals(result.valid, true); // Still valid, just warning
  assertEquals(result.warnings.length, 1);
  
  // Invalid - empty
  result = validator.validateNamingConvention("", "/tmp/.tsx");
  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
});

Deno.test("Island Validator - detects circular dependencies", async () => {
  await setupTestDirectory();
  try {
    // Create islands with circular dependency: A -> B -> C -> A
    await createTestIsland("src/islands/ComponentA.tsx", `
      import ComponentB from './ComponentB';
      export default function ComponentA() {
        return <ComponentB />;
      }
    `);
    await createTestIsland("src/islands/ComponentB.tsx", `
      import ComponentC from './ComponentC';
      export default function ComponentB() {
        return <ComponentC />;
      }
    `);
    await createTestIsland("src/islands/ComponentC.tsx", `
      import ComponentA from './ComponentA';
      export default function ComponentC() {
        return <ComponentA />;
      }
    `);
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    const validator = createIslandValidator(TEST_DIR);
    const cycles = await validator.detectCircularDependencies(allIslands);
    
    assertEquals(cycles.length, 1);
    assertEquals(cycles[0].cycle.length, 4); // A -> B -> C -> A (4 nodes including repeat)
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - no circular dependencies for independent islands", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/Counter.tsx", `
      export default function Counter() {
        return <div>Counter</div>;
      }
    `);
    await createTestIsland("src/islands/Button.tsx", `
      export default function Button() {
        return <button>Click</button>;
      }
    `);
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    const validator = createIslandValidator(TEST_DIR);
    const cycles = await validator.detectCircularDependencies(allIslands);
    
    assertEquals(cycles.length, 0);
  } finally {
    await cleanupTestDirectory();
  }
});

Deno.test("Island Validator - formatValidationError includes file path", () => {
  const error = {
    type: "invalid-export" as const,
    message: "No default export",
    filePath: "/project/src/islands/Counter.tsx",
    line: 1,
    column: 1,
    suggestion: "Add export default",
  };
  
  const formatted = formatValidationError(error, "/project");
  
  assert(formatted.includes("src/islands/Counter.tsx"));
  assert(formatted.includes("No default export"));
  assert(formatted.includes("Add export default"));
});

Deno.test("Island Validator - formatValidationWarning includes suggestion", () => {
  const warning = {
    type: "deprecated-pattern" as const,
    message: "Use PascalCase",
    filePath: "/project/src/islands/counter.tsx",
    suggestion: "Rename to Counter",
  };
  
  const formatted = formatValidationWarning(warning, "/project");
  
  assert(formatted.includes("Use PascalCase"));
  assert(formatted.includes("Rename to Counter"));
});

Deno.test("Island Validator - formatCircularDependency shows chain", () => {
  const circular = {
    cycle: ["/project/src/A.tsx", "/project/src/B.tsx", "/project/src/A.tsx"],
    description: "Circular dependency",
  };
  
  const formatted = formatCircularDependency(circular, "/project");
  
  assert(formatted.includes("src/A.tsx"));
  assert(formatted.includes("src/B.tsx"));
  assert(formatted.includes("Circular dependency"));
});

Deno.test("Island Validator - formatValidationResult shows summary", () => {
  const result = {
    valid: false,
    errors: [{
      type: "invalid-export" as const,
      message: "No export",
      filePath: "/project/src/Counter.tsx",
    }],
    warnings: [{
      type: "deprecated-pattern" as const,
      message: "Use PascalCase",
    }],
  };
  
  const formatted = formatValidationResult(result, "/project");
  
  assert(formatted.includes("1 error"));
  assert(formatted.includes("1 warning"));
  assert(formatted.includes("Validation failed"));
});

Deno.test("Island Validator - validateAllIslands combines results", async () => {
  await setupTestDirectory();
  try {
    await createTestIsland("src/islands/ValidCounter.tsx", `
      export default function ValidCounter() {
        return <div>Counter</div>;
      }
    `);
    await createTestIsland("src/islands/InvalidNoExport.tsx", `
      function InvalidNoExport() {
        return <div>No Export</div>;
      }
    `);
    
    const allIslands = await discoverAllIslands(TEST_DIR);
    const result = await validateAllIslands(allIslands, TEST_DIR);
    
    assertEquals(result.valid, false);
    assertEquals(result.errors.length, 1);
  } finally {
    await cleanupTestDirectory();
  }
});
