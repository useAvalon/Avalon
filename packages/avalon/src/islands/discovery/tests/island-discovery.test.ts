import { mkdir, rm, writeFile } from "node:fs/promises";

/**
 * Tests for Island Discovery System
 *
 * Verifies the core discovery functionality for nested islands support.
 */

import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createIslandRegistry, IslandRegistry } from "../registry.ts";
import { createIslandResolver, IslandResolver } from "../resolver.ts";
import {
	discoverAllIslands,
	discoverIslandDirectories,
	discoverIslandsInDirectory,
	getQualifiedIslandName,
	parseQualifiedIslandName,
} from "../scanner.ts";
import type { DiscoveredIsland, IslandDirectory } from "../types.ts";

// Test fixtures directory
const TEST_DIR = resolve("./test-islands-discovery-temp");

async function setupTestDirectory(): Promise<void> {
	// Clean up if exists
	try {
		await rm(TEST_DIR, { recursive: true });
	} catch {
		// Ignore if doesn't exist
	}

	// Create test directory structure
	await mkdir(join(TEST_DIR, "src", "islands"), { recursive: true });
	await mkdir(join(TEST_DIR, "src", "modules", "auth", "islands"), { recursive: true });
	await mkdir(join(TEST_DIR, "src", "modules", "dashboard", "islands"), { recursive: true });
	await mkdir(join(TEST_DIR, "src", "features", "blog", "islands"), { recursive: true });
}

async function cleanupTestDirectory(): Promise<void> {
	try {
		await rm(TEST_DIR, { recursive: true });
	} catch {
		// Ignore cleanup errors
	}
}

async function createTestIsland(
	relativePath: string,
	content = "export default function Component() { return null; }",
): Promise<void> {
	const filePath = join(TEST_DIR, relativePath);
	await writeFile(filePath, content);
}

// ============================================================================
// Scanner Tests
// ============================================================================

describe("Island Discovery - discovers default islands directory", () => {
	it("Island Discovery - discovers default islands directory", async () => {
		await setupTestDirectory();
		try {
			const directories = await discoverIslandDirectories(TEST_DIR);

			// Should find the default islands directory
			const defaultDir = directories.find((d) => d.isDefault);
			expect(defaultDir).toBeDefined();
			expect(defaultDir!.relativePath).toEqual("islands");
			expect(defaultDir!.namespace).toEqual("");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - discovers nested islands directories", () => {
	it("Island Discovery - discovers nested islands directories", async () => {
		await setupTestDirectory();
		try {
			const directories = await discoverIslandDirectories(TEST_DIR);

			// Should find all islands directories
			expect(directories.length).toEqual(4);

			// Check namespaces
			const namespaces = directories.map((d) => d.namespace).sort();
			expect(namespaces).toEqual(["", "features/blog", "modules/auth", "modules/dashboard"]);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - default directory has highest priority", () => {
	it("Island Discovery - default directory has highest priority", async () => {
		await setupTestDirectory();
		try {
			const directories = await discoverIslandDirectories(TEST_DIR);

			// Default directory should be first
			expect(directories[0].isDefault).toEqual(true);
			expect(directories[0].relativePath).toEqual("islands");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - discovers island files in directory", () => {
	it("Island Discovery - discovers island files in directory", async () => {
		await setupTestDirectory();
		try {
			// Create test island files
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/islands/Button.tsx");
			await createTestIsland("src/islands/Card.vue");

			const directories = await discoverIslandDirectories(TEST_DIR);
			const defaultDir = directories.find((d) => d.isDefault)!;

			const islands = await discoverIslandsInDirectory(defaultDir, TEST_DIR);

			expect(islands.length).toEqual(3);

			const names = islands.map((i) => i.name).sort();
			expect(names).toEqual(["Button", "Card", "Counter"]);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - detects framework from file extension", () => {
	it("Island Discovery - detects framework from file extension", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/PreactCounter.tsx");
			await createTestIsland("src/islands/VueCounter.vue");
			await createTestIsland("src/islands/SvelteCounter.svelte");
			await createTestIsland("src/islands/SolidCounter.solid.tsx");
			await createTestIsland("src/islands/LitCounter.lit.ts");

			const directories = await discoverIslandDirectories(TEST_DIR);
			const defaultDir = directories.find((d) => d.isDefault)!;
			const islands = await discoverIslandsInDirectory(defaultDir, TEST_DIR);

			const frameworks = new Map(islands.map((i) => [i.name, i.framework]));

			expect(frameworks.get("PreactCounter")).toEqual("preact");
			expect(frameworks.get("VueCounter")).toEqual("vue");
			expect(frameworks.get("SvelteCounter")).toEqual("svelte");
			expect(frameworks.get("SolidCounter")).toEqual("solid");
			expect(frameworks.get("LitCounter")).toEqual("lit");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - discovers all islands across directories", () => {
	it("Island Discovery - discovers all islands across directories", async () => {
		await setupTestDirectory();
		try {
			// Create islands in different directories
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/LoginForm.tsx");
			await createTestIsland("src/modules/dashboard/islands/Chart.tsx");
			await createTestIsland("src/features/blog/islands/PostCard.tsx");

			const allIslands = await discoverAllIslands(TEST_DIR);

			expect(allIslands.length).toEqual(4);

			const names = allIslands.map((i) => i.name).sort();
			expect(names).toEqual(["Chart", "Counter", "LoginForm", "PostCard"]);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

// ============================================================================
// Qualified Name Tests
// ============================================================================

describe("Island Discovery - qualified name for default directory", () => {
	it("Island Discovery - qualified name for default directory", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");

			const allIslands = await discoverAllIslands(TEST_DIR);
			const counter = allIslands.find((i) => i.name === "Counter")!;

			const qualifiedName = getQualifiedIslandName(counter);
			expect(qualifiedName).toEqual("Counter");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - qualified name for nested directory", () => {
	it("Island Discovery - qualified name for nested directory", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/modules/auth/islands/LoginForm.tsx");

			const allIslands = await discoverAllIslands(TEST_DIR);
			const loginForm = allIslands.find((i) => i.name === "LoginForm")!;

			const qualifiedName = getQualifiedIslandName(loginForm);
			expect(qualifiedName).toEqual("modules/auth/LoginForm");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - parse qualified name", () => {
	it("Island Discovery - parse qualified name", () => {
		// Simple name
		let result = parseQualifiedIslandName("Counter");
		expect(result.namespace).toEqual("");
		expect(result.name).toEqual("Counter");

		// Qualified name
		result = parseQualifiedIslandName("modules/auth/LoginForm");
		expect(result.namespace).toEqual("modules/auth");
		expect(result.name).toEqual("LoginForm");

		// Deeply nested
		result = parseQualifiedIslandName("features/blog/posts/PostCard");
		expect(result.namespace).toEqual("features/blog/posts");
		expect(result.name).toEqual("PostCard");
	});
});

// ============================================================================
// Registry Tests
// ============================================================================

describe("Island Registry - registers and resolves islands", () => {
	it("Island Registry - registers and resolves islands", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/LoginForm.tsx");

			const registry = await createIslandRegistry(TEST_DIR);

			expect(registry.size).toEqual(2);

			// Resolve by name
			const counter = registry.resolve("Counter");
			expect(counter).toBeDefined();
			expect(counter!.name).toEqual("Counter");

			// Resolve by qualified name
			const loginForm = registry.resolve("modules/auth/LoginForm");
			expect(loginForm).toBeDefined();
			expect(loginForm!.name).toEqual("LoginForm");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Registry - detects collisions", () => {
	it("Island Registry - detects collisions", async () => {
		await setupTestDirectory();
		try {
			// Create islands with same name in different directories
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/Counter.tsx");
			await createTestIsland("src/modules/dashboard/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const collisions = registry.detectCollisions();

			expect(collisions.length).toEqual(1);
			expect(collisions[0].name).toEqual("Counter");
			expect(collisions[0].islands.length).toEqual(3);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Registry - resolves collisions with priority", () => {
	it("Island Registry - resolves collisions with priority", async () => {
		await setupTestDirectory();
		try {
			// Create islands with same name
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);

			// Default directory should win
			const counter = registry.resolve("Counter");
			expect(counter).toBeDefined();
			expect(counter!.directory.isDefault).toEqual(true);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Registry - finds all islands by name", () => {
	it("Island Registry - finds all islands by name", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const matches = registry.findByName("Counter");

			expect(matches.length).toEqual(2);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

// ============================================================================
// Resolver Tests
// ============================================================================

describe("Island Resolver - resolves by name", () => {
	it("Island Resolver - resolves by name", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const result = resolver.resolve("Counter");
			expect(result).toBeDefined();
			expect(result!.island.name).toEqual("Counter");
			expect(result!.ambiguous).toEqual(false);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Resolver - resolves by qualified name", () => {
	it("Island Resolver - resolves by qualified name", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/modules/auth/islands/LoginForm.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const result = resolver.resolve("modules/auth/LoginForm");
			expect(result).toBeDefined();
			expect(result!.island.name).toEqual("LoginForm");
			expect(result!.island.namespace).toEqual("modules/auth");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Resolver - marks ambiguous resolutions", () => {
	it("Island Resolver - marks ambiguous resolutions", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const result = resolver.resolve("Counter");
			expect(result).toBeDefined();
			expect(result!.ambiguous).toEqual(true);
			expect(result!.alternatives).toBeDefined();
			expect(result!.alternatives!.length).toEqual(1);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Resolver - generates import paths", () => {
	it("Island Resolver - generates import paths", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const result = resolver.resolve("Counter");
			expect(result).toBeDefined();

			// Import path should be relative
			expect(result!.importPath.includes("Counter.tsx")).toBeTruthy();
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Resolver - suggests qualified names for disambiguation", () => {
	it("Island Resolver - suggests qualified names for disambiguation", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/modules/auth/islands/Counter.tsx");

			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const suggestions = resolver.suggestQualifiedNames("Counter");

			expect(suggestions.length).toEqual(2);
			expect(suggestions.includes("Counter")).toBeTruthy();
			expect(suggestions.includes("modules/auth/Counter")).toBeTruthy();
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Resolver - provides resolution order documentation", () => {
	it("Island Resolver - provides resolution order documentation", async () => {
		await setupTestDirectory();
		try {
			const registry = await createIslandRegistry(TEST_DIR);
			const resolver = createIslandResolver(registry, TEST_DIR);

			const order = resolver.getResolutionOrder();

			expect(order.length > 0).toBeTruthy();
			expect(order.some((line) => line.includes("default"))).toBeTruthy();
		} finally {
			await cleanupTestDirectory();
		}
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Island Discovery - handles empty directories", () => {
	it("Island Discovery - handles empty directories", async () => {
		await setupTestDirectory();
		try {
			// Don't create any island files
			const allIslands = await discoverAllIslands(TEST_DIR);
			expect(allIslands.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - handles nonexistent directory", () => {
	it("Island Discovery - handles nonexistent directory", async () => {
		const nonexistentDir = "/tmp/nonexistent_islands_" + Date.now();

		const directories = await discoverIslandDirectories(nonexistentDir);
		expect(directories.length).toEqual(0);
	});
});

describe("Island Discovery - ignores unsupported file extensions", () => {
	it("Island Discovery - ignores unsupported file extensions", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland("src/islands/Counter.tsx");
			await createTestIsland("src/islands/styles.css", "/* CSS */");
			await createTestIsland("src/islands/README.md", "# README");

			const allIslands = await discoverAllIslands(TEST_DIR);

			// Should only find the .tsx file
			expect(allIslands.length).toEqual(1);
			expect(allIslands[0].name).toEqual("Counter");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Discovery - excludes node_modules", () => {
	it("Island Discovery - excludes node_modules", async () => {
		await setupTestDirectory();
		try {
			// Create islands in node_modules (should be excluded)
			await mkdir(join(TEST_DIR, "src", "node_modules", "some-package", "islands"), {
				recursive: true,
			});
			await createTestIsland("src/node_modules/some-package/islands/Counter.tsx");

			// Create a valid island
			await createTestIsland("src/islands/Button.tsx");

			const allIslands = await discoverAllIslands(TEST_DIR);

			// Should only find Button, not the one in node_modules
			expect(allIslands.length).toEqual(1);
			expect(allIslands[0].name).toEqual("Button");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

// ============================================================================
// Validator Tests
// ============================================================================

import {
	createIslandValidator,
	formatCircularDependency,
	formatValidationError,
	formatValidationResult,
	formatValidationWarning,
	IslandValidator,
	validateAllIslands,
} from "../validator.ts";

describe("Island Validator - validates valid component", () => {
	it("Island Validator - validates valid component", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/Counter.tsx",
				`
        export default function Counter() {
          return <div>Counter</div>;
        }
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/Counter.tsx");
			const result = await validator.validateComponent(filePath);

			expect(result.valid).toEqual(true);
			expect(result.errors.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - detects missing export", () => {
	it("Island Validator - detects missing export", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/NoExport.tsx",
				`
        function NoExport() {
          return <div>No Export</div>;
        }
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/NoExport.tsx");
			const result = await validator.validateComponent(filePath);

			expect(result.valid).toEqual(false);
			expect(result.errors.length).toEqual(1);
			expect(result.errors[0].type).toEqual("invalid-export");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - validates Vue component", () => {
	it("Island Validator - validates Vue component", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/VueCounter.vue",
				`
        <template>
          <div>{{ count }}</div>
        </template>
        <script setup>
          import { ref } from 'vue';
          const count = ref(0);
        </script>
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/VueCounter.vue");
			const result = await validator.validateComponent(filePath);

			expect(result.valid).toEqual(true);
			expect(result.errors.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - validates Svelte component", () => {
	it("Island Validator - validates Svelte component", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/SvelteCounter.svelte",
				`
        <script>
          let count = 0;
        </script>
        <button on:click={() => count++}>{count}</button>
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/SvelteCounter.svelte");
			const result = await validator.validateComponent(filePath);

			expect(result.valid).toEqual(true);
			expect(result.errors.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - warns on lowercase component name", () => {
	it("Island Validator - warns on lowercase component name", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/counter.tsx",
				`
        export default function counter() {
          return <div>Counter</div>;
        }
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/counter.tsx");
			const result = await validator.validateComponent(filePath);

			// Should pass but with warning
			expect(result.valid).toEqual(true);
			expect(result.warnings.length).toEqual(1);
			expect(result.warnings[0].type).toEqual("deprecated-pattern");
			expect(result.warnings[0].message.includes("PascalCase")).toBeTruthy();
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - validates Lit component", () => {
	it("Island Validator - validates Lit component", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/LitCounter.lit.ts",
				`
        import { LitElement, html } from 'lit';
        import { customElement } from 'lit/decorators.js';

        @customElement('lit-counter')
        export class LitCounter extends LitElement {
          render() {
            return html\`<div>Counter</div>\`;
          }
        }
      `,
			);

			const validator = createIslandValidator(TEST_DIR);
			const filePath = join(TEST_DIR, "src/islands/LitCounter.lit.ts");
			const result = await validator.validateComponent(filePath);

			expect(result.valid).toEqual(true);
			expect(result.errors.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - validates directory with empty warning", () => {
	it("Island Validator - validates directory with empty warning", async () => {
		await setupTestDirectory();
		try {
			const directories = await discoverIslandDirectories(TEST_DIR);
			const defaultDir = directories.find((d) => d.isDefault)!;

			const validator = createIslandValidator(TEST_DIR);
			const result = await validator.validateDirectory(defaultDir);

			expect(result.valid).toEqual(true);
			expect(result.warnings.length).toEqual(1);
			expect(result.warnings[0].type).toEqual("empty-directory");
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - validates naming convention", () => {
	it("Island Validator - validates naming convention", () => {
		const validator = createIslandValidator("/tmp");

		// Valid PascalCase
		let result = validator.validateNamingConvention("Counter", "/tmp/Counter.tsx");
		expect(result.valid).toEqual(true);
		expect(result.errors.length).toEqual(0);
		expect(result.warnings.length).toEqual(0);

		// Valid PascalCase with numbers
		result = validator.validateNamingConvention("Counter2", "/tmp/Counter2.tsx");
		expect(result.valid).toEqual(true);

		// Invalid - lowercase
		result = validator.validateNamingConvention("counter", "/tmp/counter.tsx");
		expect(result.valid).toEqual(true); // Still valid, just warning
		expect(result.warnings.length).toEqual(1);

		// Invalid - empty
		result = validator.validateNamingConvention("", "/tmp/.tsx");
		expect(result.valid).toEqual(false);
		expect(result.errors.length).toEqual(1);
	});
});

describe("Island Validator - detects circular dependencies", () => {
	it("Island Validator - detects circular dependencies", async () => {
		await setupTestDirectory();
		try {
			// Create islands with circular dependency: A -> B -> C -> A
			await createTestIsland(
				"src/islands/ComponentA.tsx",
				`
        import ComponentB from './ComponentB';
        export default function ComponentA() {
          return <ComponentB />;
        }
      `,
			);
			await createTestIsland(
				"src/islands/ComponentB.tsx",
				`
        import ComponentC from './ComponentC';
        export default function ComponentB() {
          return <ComponentC />;
        }
      `,
			);
			await createTestIsland(
				"src/islands/ComponentC.tsx",
				`
        import ComponentA from './ComponentA';
        export default function ComponentC() {
          return <ComponentA />;
        }
      `,
			);

			const allIslands = await discoverAllIslands(TEST_DIR);
			const validator = createIslandValidator(TEST_DIR);
			const cycles = await validator.detectCircularDependencies(allIslands);

			expect(cycles.length).toEqual(1);
			expect(cycles[0].cycle.length).toEqual(4); // A -> B -> C -> A (4 nodes including repeat)
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - no circular dependencies for independent islands", () => {
	it("Island Validator - no circular dependencies for independent islands", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/Counter.tsx",
				`
        export default function Counter() {
          return <div>Counter</div>;
        }
      `,
			);
			await createTestIsland(
				"src/islands/Button.tsx",
				`
        export default function Button() {
          return <button>Click</button>;
        }
      `,
			);

			const allIslands = await discoverAllIslands(TEST_DIR);
			const validator = createIslandValidator(TEST_DIR);
			const cycles = await validator.detectCircularDependencies(allIslands);

			expect(cycles.length).toEqual(0);
		} finally {
			await cleanupTestDirectory();
		}
	});
});

describe("Island Validator - formatValidationError includes file path", () => {
	it("Island Validator - formatValidationError includes file path", () => {
		const error = {
			type: "invalid-export" as const,
			message: "No default export",
			filePath: "/project/src/islands/Counter.tsx",
			line: 1,
			column: 1,
			suggestion: "Add export default",
		};

		const formatted = formatValidationError(error, "/project");

		expect(formatted.includes("src/islands/Counter.tsx")).toBeTruthy();
		expect(formatted.includes("No default export")).toBeTruthy();
		expect(formatted.includes("Add export default")).toBeTruthy();
	});
});

describe("Island Validator - formatValidationWarning includes suggestion", () => {
	it("Island Validator - formatValidationWarning includes suggestion", () => {
		const warning = {
			type: "deprecated-pattern" as const,
			message: "Use PascalCase",
			filePath: "/project/src/islands/counter.tsx",
			suggestion: "Rename to Counter",
		};

		const formatted = formatValidationWarning(warning, "/project");

		expect(formatted.includes("Use PascalCase")).toBeTruthy();
		expect(formatted.includes("Rename to Counter")).toBeTruthy();
	});
});

describe("Island Validator - formatCircularDependency shows chain", () => {
	it("Island Validator - formatCircularDependency shows chain", () => {
		const circular = {
			cycle: ["/project/src/A.tsx", "/project/src/B.tsx", "/project/src/A.tsx"],
			description: "Circular dependency",
		};

		const formatted = formatCircularDependency(circular, "/project");

		expect(formatted.includes("src/A.tsx")).toBeTruthy();
		expect(formatted.includes("src/B.tsx")).toBeTruthy();
		expect(formatted.includes("Circular dependency")).toBeTruthy();
	});
});

describe("Island Validator - formatValidationResult shows summary", () => {
	it("Island Validator - formatValidationResult shows summary", () => {
		const result = {
			valid: false,
			errors: [
				{
					type: "invalid-export" as const,
					message: "No export",
					filePath: "/project/src/Counter.tsx",
				},
			],
			warnings: [
				{
					type: "deprecated-pattern" as const,
					message: "Use PascalCase",
				},
			],
		};

		const formatted = formatValidationResult(result, "/project");

		expect(formatted.includes("1 error")).toBeTruthy();
		expect(formatted.includes("1 warning")).toBeTruthy();
		expect(formatted.includes("Validation failed")).toBeTruthy();
	});
});

describe("Island Validator - validateAllIslands combines results", () => {
	it("Island Validator - validateAllIslands combines results", async () => {
		await setupTestDirectory();
		try {
			await createTestIsland(
				"src/islands/ValidCounter.tsx",
				`
        export default function ValidCounter() {
          return <div>Counter</div>;
        }
      `,
			);
			await createTestIsland(
				"src/islands/InvalidNoExport.tsx",
				`
        function InvalidNoExport() {
          return <div>No Export</div>;
        }
      `,
			);

			const allIslands = await discoverAllIslands(TEST_DIR);
			const result = await validateAllIslands(allIslands, TEST_DIR);

			expect(result.valid).toEqual(false);
			expect(result.errors.length).toEqual(1);
		} finally {
			await cleanupTestDirectory();
		}
	});
});
