import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import { IntegrationRegistry } from "./registry.ts";
import type { Integration } from "../../integrations/shared/types.ts";

// Test fixture - mock integration
function createMockIntegration(name: string, version = "1.0.0"): Integration {
  return {
    name,
    version,
    async render(params) {
      return {
        html: `<div>${name}</div>`,
        hydrationData: { src: params.src, props: params.props },
      };
    },
    getHydrationScript() {
      return `console.log('${name} hydrate');`;
    },
    config() {
      return {
        name,
        fileExtensions: [`.${name}`],
        detectionPatterns: {
          imports: [new RegExp(`^${name}$`)],
          content: [new RegExp(`\\b${name}\\b`)],
        },
      };
    },
  };
}

Deno.test("IntegrationRegistry - Registration", async (t) => {
  await t.step("should register an integration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    
    assertEquals(registry.has("test"), true);
    assertEquals(registry.size, 1);
  });

  await t.step("should retrieve registered integration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    const retrieved = registry.get("test");
    
    assertExists(retrieved);
    assertEquals(retrieved.name, "test");
    assertEquals(retrieved.version, "1.0.0");
  });

  await t.step("should register multiple integrations", () => {
    const registry = new IntegrationRegistry();
    const integration1 = createMockIntegration("test1");
    const integration2 = createMockIntegration("test2");
    
    registry.register(integration1);
    registry.register(integration2);
    
    assertEquals(registry.size, 2);
    assertEquals(registry.has("test1"), true);
    assertEquals(registry.has("test2"), true);
  });

  await t.step("should overwrite existing integration with same name", () => {
    const registry = new IntegrationRegistry();
    const integration1 = createMockIntegration("test", "1.0.0");
    const integration2 = createMockIntegration("test", "2.0.0");
    
    registry.register(integration1);
    registry.register(integration2);
    
    assertEquals(registry.size, 1);
    const retrieved = registry.get("test");
    assertExists(retrieved);
    assertEquals(retrieved.version, "2.0.0");
  });

  await t.step("should throw error when registering integration without name", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    delete (integration as any).name;
    
    let error: Error | null = null;
    try {
      registry.register(integration);
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("name"), true);
  });
});

Deno.test("IntegrationRegistry - Retrieval", async (t) => {
  await t.step("should return undefined for non-existent integration", () => {
    const registry = new IntegrationRegistry();
    const retrieved = registry.get("nonexistent");
    
    assertEquals(retrieved, undefined);
  });

  await t.step("should check if integration exists", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    assertEquals(registry.has("test"), false);
    registry.register(integration);
    assertEquals(registry.has("test"), true);
  });

  await t.step("should get all registered integrations", () => {
    const registry = new IntegrationRegistry();
    const integration1 = createMockIntegration("test1");
    const integration2 = createMockIntegration("test2");
    
    registry.register(integration1);
    registry.register(integration2);
    
    const all = registry.getAll();
    assertEquals(all.length, 2);
    assertEquals(all.some((i) => i.name === "test1"), true);
    assertEquals(all.some((i) => i.name === "test2"), true);
  });

  await t.step("should get all registered integration names", () => {
    const registry = new IntegrationRegistry();
    const integration1 = createMockIntegration("test1");
    const integration2 = createMockIntegration("test2");
    
    registry.register(integration1);
    registry.register(integration2);
    
    const names = registry.getAllNames();
    assertEquals(names.length, 2);
    assertEquals(names.includes("test1"), true);
    assertEquals(names.includes("test2"), true);
  });
});

Deno.test("IntegrationRegistry - Dynamic Loading", async (t) => {
  await t.step("should return cached integration if already loaded", async () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("preact");
    
    registry.register(integration);
    const loaded = await registry.load("preact");
    
    assertEquals(loaded, integration);
  });

  await t.step("should throw error for non-existent integration module", async () => {
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
      await registry.load("missing");
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("@avalon/integration-missing"), true);
    assertEquals(error.message.includes("installed"), true);
  });

  await t.step("should prevent duplicate loads with concurrent requests", async () => {
    const registry = new IntegrationRegistry();
    
    // Both loads should use the same promise
    const promise1 = registry.load("preact");
    const promise2 = registry.load("preact");
    
    // They should be the same promise instance
    assertEquals(promise1, promise2);
    
    // Wait for both to complete
    try {
      await Promise.all([promise1, promise2]);
    } catch {
      // Expected to fail since preact module doesn't exist in test
    }
  });
});

Deno.test("IntegrationRegistry - Unregistration", async (t) => {
  await t.step("should unregister an integration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    assertEquals(registry.has("test"), true);
    
    const result = registry.unregister("test");
    assertEquals(result, true);
    assertEquals(registry.has("test"), false);
  });

  await t.step("should return false when unregistering non-existent integration", () => {
    const registry = new IntegrationRegistry();
    
    const result = registry.unregister("nonexistent");
    assertEquals(result, false);
  });

  await t.step("should update size after unregistration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    assertEquals(registry.size, 1);
    
    registry.unregister("test");
    assertEquals(registry.size, 0);
  });
});

Deno.test("IntegrationRegistry - Clear", async (t) => {
  await t.step("should clear all integrations", () => {
    const registry = new IntegrationRegistry();
    const integration1 = createMockIntegration("test1");
    const integration2 = createMockIntegration("test2");
    
    registry.register(integration1);
    registry.register(integration2);
    assertEquals(registry.size, 2);
    
    registry.clear();
    assertEquals(registry.size, 0);
    assertEquals(registry.has("test1"), false);
    assertEquals(registry.has("test2"), false);
  });

  await t.step("should clear loading promises", () => {
    const registry = new IntegrationRegistry();
    
    // Start a load (will fail but that's ok)
    registry.load("test").catch(() => {});
    
    registry.clear();
    assertEquals(registry.size, 0);
  });
});

Deno.test("IntegrationRegistry - Size", async (t) => {
  await t.step("should track size correctly", () => {
    const registry = new IntegrationRegistry();
    
    assertEquals(registry.size, 0);
    
    registry.register(createMockIntegration("test1"));
    assertEquals(registry.size, 1);
    
    registry.register(createMockIntegration("test2"));
    assertEquals(registry.size, 2);
    
    registry.unregister("test1");
    assertEquals(registry.size, 1);
    
    registry.clear();
    assertEquals(registry.size, 0);
  });
});

Deno.test("IntegrationRegistry - Integration Methods", async (t) => {
  await t.step("should call render method on registered integration", async () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    const retrieved = registry.get("test");
    assertExists(retrieved);
    
    const result = await retrieved.render({
      component: null,
      props: { count: 0 },
      src: "/test.tsx",
    });
    
    assertEquals(result.html, "<div>test</div>");
    assertExists(result.hydrationData);
  });

  await t.step("should call getHydrationScript on registered integration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    const retrieved = registry.get("test");
    assertExists(retrieved);
    
    const script = retrieved.getHydrationScript();
    assertEquals(script.includes("test hydrate"), true);
  });

  await t.step("should call config method on registered integration", () => {
    const registry = new IntegrationRegistry();
    const integration = createMockIntegration("test");
    
    registry.register(integration);
    const retrieved = registry.get("test");
    assertExists(retrieved);
    
    const config = retrieved.config();
    assertEquals(config.name, "test");
    assertEquals(config.fileExtensions.includes(".test"), true);
  });
});
