import { assertEquals, assertExists } from "jsr:@std/assert";
import { validateIntegration } from "./validator.ts";
import type { Integration } from "../../integrations/shared/types.ts";

/**
 * Integration compliance tests
 * These tests verify that each framework integration properly implements
 * the Integration interface and follows the required patterns.
 */

// Dynamically load integrations to avoid import errors during testing
async function loadIntegrations(): Promise<Array<{ name: string; integration: Integration }>> {
  const integrations: Array<{ name: string; integration: Integration }> = [];
  
  try {
    const { preactIntegration } = await import("../../integrations/preact/mod.ts");
    integrations.push({ name: "Preact", integration: preactIntegration });
  } catch (error) {
    console.warn("Could not load Preact integration:", error.message);
  }
  
  try {
    const { vueIntegration } = await import("../../integrations/vue/mod.ts");
    integrations.push({ name: "Vue", integration: vueIntegration });
  } catch (error) {
    console.warn("Could not load Vue integration:", error.message);
  }
  
  try {
    const { solidIntegration } = await import("../../integrations/solid/mod.ts");
    integrations.push({ name: "Solid", integration: solidIntegration });
  } catch (error) {
    console.warn("Could not load Solid integration:", error.message);
  }
  
  try {
    const { svelteIntegration } = await import("../../integrations/svelte/mod.ts");
    integrations.push({ name: "Svelte", integration: svelteIntegration });
  } catch (error) {
    console.warn("Could not load Svelte integration:", error.message);
  }
  
  return integrations;
}

const integrations = await loadIntegrations();

Deno.test("Integration Compliance - Interface Implementation", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} should implement Integration interface`, () => {
      const result = validateIntegration(integration);
      
      if (!result.valid) {
        console.error(`${name} validation errors:`, result.errors);
        console.error(`${name} validation warnings:`, result.warnings);
      }
      
      assertEquals(result.valid, true, `${name} integration is not valid`);
    });
  }
});

Deno.test("Integration Compliance - Required Properties", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} should have name property`, () => {
      assertExists(integration.name);
      assertEquals(typeof integration.name, "string");
      assertEquals(integration.name.length > 0, true);
    });

    await t.step(`${name} should have version property`, () => {
      assertExists(integration.version);
      assertEquals(typeof integration.version, "string");
      assertEquals(integration.version.length > 0, true);
    });
  }
});

Deno.test("Integration Compliance - Required Methods", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} should have render method`, () => {
      assertExists(integration.render);
      assertEquals(typeof integration.render, "function");
    });

    await t.step(`${name} should have getHydrationScript method`, () => {
      assertExists(integration.getHydrationScript);
      assertEquals(typeof integration.getHydrationScript, "function");
    });

    await t.step(`${name} should have config method`, () => {
      assertExists(integration.config);
      assertEquals(typeof integration.config, "function");
    });
  }
});

Deno.test("Integration Compliance - Config Method", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} config should return valid configuration`, () => {
      const config = integration.config();
      
      assertExists(config);
      assertExists(config.name);
      assertEquals(typeof config.name, "string");
      
      assertExists(config.fileExtensions);
      assertEquals(Array.isArray(config.fileExtensions), true);
      assertEquals(config.fileExtensions.length > 0, true);
      
      assertExists(config.detectionPatterns);
      assertExists(config.detectionPatterns.imports);
      assertExists(config.detectionPatterns.content);
      assertEquals(Array.isArray(config.detectionPatterns.imports), true);
      assertEquals(Array.isArray(config.detectionPatterns.content), true);
    });

    await t.step(`${name} config should have valid file extensions`, () => {
      const config = integration.config();
      
      config.fileExtensions.forEach((ext) => {
        assertEquals(typeof ext, "string");
        assertEquals(ext.startsWith("."), true, `Extension ${ext} should start with a dot`);
      });
    });

    await t.step(`${name} config should have valid detection patterns`, () => {
      const config = integration.config();
      
      config.detectionPatterns.imports.forEach((pattern) => {
        assertEquals(pattern instanceof RegExp, true, "Import pattern should be RegExp");
      });
      
      config.detectionPatterns.content.forEach((pattern) => {
        assertEquals(pattern instanceof RegExp, true, "Content pattern should be RegExp");
      });
    });
  }
});

Deno.test("Integration Compliance - GetHydrationScript Method", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} getHydrationScript should return string`, () => {
      const script = integration.getHydrationScript();
      
      assertEquals(typeof script, "string");
      assertEquals(script.length > 0, true);
    });

    await t.step(`${name} hydration script should be valid JavaScript`, () => {
      const script = integration.getHydrationScript();
      
      // Basic check - should not have obvious syntax errors
      // Should contain common patterns
      const hasImport = script.includes("import") || script.includes("require");
      const hasFunction = script.includes("function") || script.includes("=>");
      const hasHydrate = script.toLowerCase().includes("hydrate");
      
      // At least one of these should be true for a valid hydration script
      assertEquals(
        hasImport || hasFunction || hasHydrate,
        true,
        `${name} hydration script should contain imports, functions, or hydrate calls`
      );
    });
  }
});

Deno.test("Integration Compliance - Render Method Signature", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} render should accept RenderParams`, async () => {
      // Test with minimal valid params
      const params = {
        component: null,
        props: {},
        src: "/test.tsx",
      };
      
      // Should not throw for valid params structure
      let error = null;
      try {
        // We expect this to fail with module loading errors, not parameter errors
        await integration.render(params);
      } catch (e) {
        error = e;
      }
      
      // If there's an error, it should be about loading the component, not invalid params
      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Should not be a parameter validation error
        assertEquals(
          errorMessage.includes("params") && errorMessage.includes("invalid"),
          false,
          `${name} should accept valid RenderParams`
        );
      }
    });
  }
});

Deno.test("Integration Compliance - Framework-Specific Config", async (t) => {
  const preact = integrations.find((i) => i.name === "Preact");
  const vue = integrations.find((i) => i.name === "Vue");
  const solid = integrations.find((i) => i.name === "Solid");
  const svelte = integrations.find((i) => i.name === "Svelte");

  if (preact) {
    await t.step("Preact config should match framework", () => {
      const config = preact.integration.config();
      assertEquals(config.name, "preact");
      assertEquals(config.fileExtensions.some((ext) => ext === ".tsx" || ext === ".jsx"), true);
    });
  }

  if (vue) {
    await t.step("Vue config should match framework", () => {
      const config = vue.integration.config();
      assertEquals(config.name, "vue");
      assertEquals(config.fileExtensions.includes(".vue"), true);
    });
  }

  if (solid) {
    await t.step("Solid config should match framework", () => {
      const config = solid.integration.config();
      assertEquals(config.name, "solid");
      assertEquals(config.fileExtensions.some((ext) => ext === ".tsx" || ext === ".jsx"), true);
    });
  }

  if (svelte) {
    await t.step("Svelte config should match framework", () => {
      const config = svelte.integration.config();
      assertEquals(config.name, "svelte");
      assertEquals(config.fileExtensions.includes(".svelte"), true);
    });
  }
});

Deno.test("Integration Compliance - Detection Patterns", async (t) => {
  const preact = integrations.find((i) => i.name === "Preact");
  const vue = integrations.find((i) => i.name === "Vue");
  const solid = integrations.find((i) => i.name === "Solid");
  const svelte = integrations.find((i) => i.name === "Svelte");

  if (preact) {
    await t.step("Preact should detect preact imports", () => {
      const config = preact.integration.config();
      const hasPreactPattern = config.detectionPatterns.imports.some((pattern) =>
        pattern.test("preact") || pattern.test("preact/hooks")
      );
      assertEquals(hasPreactPattern, true);
    });
  }

  if (vue) {
    await t.step("Vue should detect vue imports", () => {
      const config = vue.integration.config();
      const hasVuePattern = config.detectionPatterns.imports.some((pattern) =>
        pattern.test("vue")
      );
      assertEquals(hasVuePattern, true);
    });
  }

  if (solid) {
    await t.step("Solid should detect solid-js imports", () => {
      const config = solid.integration.config();
      const hasSolidPattern = config.detectionPatterns.imports.some((pattern) =>
        pattern.test("solid-js") || pattern.test("solid-js/web")
      );
      assertEquals(hasSolidPattern, true);
    });
  }

  if (svelte) {
    await t.step("Svelte should detect svelte imports", () => {
      const config = svelte.integration.config();
      const hasSveltePattern = config.detectionPatterns.imports.some((pattern) =>
        pattern.test("svelte")
      );
      assertEquals(hasSveltePattern, true);
    });
  }
});

Deno.test("Integration Compliance - Version Format", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} version should follow semver format`, () => {
      const version = integration.version;
      
      // Basic semver check: should have at least major.minor.patch
      const semverPattern = /^\d+\.\d+\.\d+/;
      assertEquals(
        semverPattern.test(version),
        true,
        `${name} version ${version} should follow semver format (e.g., 1.0.0)`
      );
    });
  }
});

Deno.test("Integration Compliance - Optional Methods", async (t) => {
  for (const { name, integration } of integrations) {
    await t.step(`${name} vitePlugin should be function if present`, () => {
      if (integration.vitePlugin !== undefined) {
        assertEquals(typeof integration.vitePlugin, "function");
      }
    });
  }
});

Deno.test("Integration Compliance - Consistency", async (t) => {
  await t.step("All integrations should have unique names", () => {
    const names = integrations.map((i) => i.integration.name);
    const uniqueNames = new Set(names);
    assertEquals(names.length, uniqueNames.size, "Integration names should be unique");
  });

  await t.step("All integrations should have unique file extensions", () => {
    const allExtensions = integrations.flatMap((i) => i.integration.config().fileExtensions);
    
    // Check for conflicts (same extension used by multiple frameworks)
    const extensionMap = new Map<string, string[]>();
    integrations.forEach(({ integration }) => {
      const config = integration.config();
      config.fileExtensions.forEach((ext) => {
        if (!extensionMap.has(ext)) {
          extensionMap.set(ext, []);
        }
        extensionMap.get(ext)!.push(integration.name);
      });
    });
    
    // .tsx and .jsx can be shared between Preact and Solid (that's expected)
    // But .vue and .svelte should be unique
    const conflicts = Array.from(extensionMap.entries())
      .filter(([ext, frameworks]) => {
        if (ext === ".tsx" || ext === ".jsx") {
          // These can be shared between Preact and Solid
          return frameworks.length > 2;
        }
        return frameworks.length > 1;
      });
    
    assertEquals(
      conflicts.length,
      0,
      `File extension conflicts found: ${JSON.stringify(conflicts)}`
    );
  });
});
