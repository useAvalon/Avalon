import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import { IntegrationRegistry } from "./registry.ts";
import { loadIntegration, clearIntegrationCache } from "./loader.ts";
import type { Integration } from "../../integrations/shared/types.ts";

/**
 * Tests for fallback behavior when integrations are missing or fail to load
 */

Deno.test("Fallback Behavior - Missing Integration", async (t) => {
  await t.step("should throw error when loading non-existent integration", async () => {
    const registry = new IntegrationRegistry();
    
    await assertRejects(
      async () => {
        await registry.load("nonexistent-framework");
      },
      Error,
      "Failed to load integration"
    );
  });

  await t.step("should provide helpful error message for missing integration", async () => {
    const registry = new IntegrationRegistry();
    
    let error: Error | null = null;
    try {
      await registry.load("missing-framework");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("missing-framework"), true);
    assertEquals(error.message.includes("installed"), true);
    assertEquals(error.message.includes("@avalon/integration-"), true);
  });

  await t.step("should include installation instructions in error", async () => {
    const registry = new IntegrationRegistry();
    
    let error: Error | null = null;
    try {
      await registry.load("custom-framework");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("@avalon/integration-custom-framework"), true);
  });
});

Deno.test("Fallback Behavior - Invalid Integration Module", async (t) => {
  await t.step("should handle integration module without proper export", async () => {
    const registry = new IntegrationRegistry();
    
    // Try to load an integration that exists but doesn't export correctly
    // This will fail because the module structure is wrong
    let error: Error | null = null;
    try {
      await registry.load("invalid-export");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("Failed to load"), true);
  });
});

Deno.test("Fallback Behavior - Registry State", async (t) => {
  await t.step("should maintain registry state after failed load", async () => {
    const registry = new IntegrationRegistry();
    
    // Register a valid integration
    const validIntegration: Integration = {
      name: "valid",
      version: "1.0.0",
      async render() {
        return { html: "<div>test</div>" };
      },
      getHydrationScript() {
        return "console.log('hydrate');";
      },
      config() {
        return {
          name: "valid",
          fileExtensions: [".valid"],
          detectionPatterns: { imports: [], content: [] },
        };
      },
    };
    
    registry.register(validIntegration);
    assertEquals(registry.size, 1);
    
    // Try to load invalid integration
    try {
      await registry.load("invalid");
    } catch {
      // Expected to fail
    }
    
    // Registry should still have the valid integration
    assertEquals(registry.size, 1);
    assertEquals(registry.has("valid"), true);
  });

  await t.step("should not cache failed integration loads", async () => {
    const registry = new IntegrationRegistry();
    
    // Try to load twice - both should fail
    let error1: Error | null = null;
    let error2: Error | null = null;
    
    try {
      await registry.load("missing1");
    } catch (e) {
      error1 = e as Error;
    }
    
    try {
      await registry.load("missing1");
    } catch (e) {
      error2 = e as Error;
    }
    
    assertExists(error1);
    assertExists(error2);
    
    // Should not be in registry
    assertEquals(registry.has("missing1"), false);
  });
});

Deno.test("Fallback Behavior - Loader Cache", async (t) => {
  await t.step("should not cache failed integration in loader", async () => {
    clearIntegrationCache();
    
    // Try to load non-existent integration
    let error: Error | null = null;
    try {
      await loadIntegration("nonexistent");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    
    // Should not be in cache
    // Note: We can't directly test isIntegrationLoaded for failed loads
    // but we can verify it throws again
    let error2: Error | null = null;
    try {
      await loadIntegration("nonexistent");
    } catch (e) {
      error2 = e as Error;
    }
    
    assertExists(error2);
  });
});

Deno.test("Fallback Behavior - Concurrent Load Failures", async (t) => {
  await t.step("should handle concurrent failed loads gracefully", async () => {
    const registry = new IntegrationRegistry();
    
    // Try to load same missing integration concurrently
    const promises = [
      registry.load("concurrent-missing"),
      registry.load("concurrent-missing"),
      registry.load("concurrent-missing"),
    ];
    
    const results = await Promise.allSettled(promises);
    
    // All should fail
    results.forEach((result) => {
      assertEquals(result.status, "rejected");
      if (result.status === "rejected") {
        assertEquals(result.reason.message.includes("Failed to load"), true);
      }
    });
    
    // Should not be in registry
    assertEquals(registry.has("concurrent-missing"), false);
  });
});

Deno.test("Fallback Behavior - Error Information", async (t) => {
  await t.step("should include cause in error", async () => {
    const registry = new IntegrationRegistry();
    
    let error: Error | null = null;
    try {
      await registry.load("missing-with-cause");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    // Error should have a cause property
    assertExists((error as any).cause);
  });

  await t.step("should provide framework-specific error messages", async () => {
    const registry = new IntegrationRegistry();
    
    const frameworks = ["react", "angular", "ember"];
    
    for (const framework of frameworks) {
      let error: Error | null = null;
      try {
        await registry.load(framework);
      } catch (e) {
        error = e as Error;
      }
      
      assertExists(error);
      assertEquals(error.message.includes(framework), true);
      assertEquals(error.message.includes(`@avalon/integration-${framework}`), true);
    }
  });
});

Deno.test("Fallback Behavior - Graceful Degradation", async (t) => {
  await t.step("should allow checking if integration exists before loading", () => {
    const registry = new IntegrationRegistry();
    
    // Check before loading
    assertEquals(registry.has("unknown"), false);
    
    // This allows code to check before attempting to load
    if (!registry.has("unknown")) {
      // Can provide fallback or alternative behavior
      assertEquals(true, true); // Test passes
    }
  });

  await t.step("should allow listing available integrations", () => {
    const registry = new IntegrationRegistry();
    
    // Register some integrations
    const integration1: Integration = {
      name: "available1",
      version: "1.0.0",
      async render() {
        return { html: "" };
      },
      getHydrationScript() {
        return "";
      },
      config() {
        return {
          name: "available1",
          fileExtensions: [".a1"],
          detectionPatterns: { imports: [], content: [] },
        };
      },
    };
    
    registry.register(integration1);
    
    const available = registry.getAllNames();
    assertEquals(available.includes("available1"), true);
    assertEquals(available.includes("nonexistent"), false);
  });
});

Deno.test("Fallback Behavior - Recovery", async (t) => {
  await t.step("should allow retry after failed load", async () => {
    const registry = new IntegrationRegistry();
    
    // First attempt fails
    let error1: Error | null = null;
    try {
      await registry.load("retry-test");
    } catch (e) {
      error1 = e as Error;
    }
    assertExists(error1);
    
    // Second attempt should also fail (not cached)
    let error2: Error | null = null;
    try {
      await registry.load("retry-test");
    } catch (e) {
      error2 = e as Error;
    }
    assertExists(error2);
    
    // Both errors should be similar
    assertEquals(error1.message.includes("Failed to load"), true);
    assertEquals(error2.message.includes("Failed to load"), true);
  });

  await t.step("should allow manual registration after failed load", async () => {
    const registry = new IntegrationRegistry();
    
    // Try to load (will fail)
    try {
      await registry.load("manual-register");
    } catch {
      // Expected
    }
    
    // Manually register the integration
    const integration: Integration = {
      name: "manual-register",
      version: "1.0.0",
      async render() {
        return { html: "<div>manual</div>" };
      },
      getHydrationScript() {
        return "console.log('manual');";
      },
      config() {
        return {
          name: "manual-register",
          fileExtensions: [".manual"],
          detectionPatterns: { imports: [], content: [] },
        };
      },
    };
    
    registry.register(integration);
    
    // Now it should be available
    assertEquals(registry.has("manual-register"), true);
    const loaded = registry.get("manual-register");
    assertExists(loaded);
    assertEquals(loaded.name, "manual-register");
  });
});

Deno.test("Fallback Behavior - Error Messages Quality", async (t) => {
  await t.step("should provide actionable error messages", async () => {
    const registry = new IntegrationRegistry();
    
    let error: Error | null = null;
    try {
      await registry.load("helpful-error");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    const message = error.message.toLowerCase();
    
    // Should mention what failed
    assertEquals(message.includes("failed"), true);
    
    // Should mention the integration name
    assertEquals(message.includes("helpful-error"), true);
    
    // Should provide guidance
    assertEquals(
      message.includes("install") || message.includes("configured"),
      true
    );
  });
});
