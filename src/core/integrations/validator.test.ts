import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  validateIntegration,
  validateIntegrationConfig,
  validateIntegrations,
  assertValidIntegration,
  formatValidationResult,
  type ValidationResult,
} from "./validator.ts";
import type { Integration, IntegrationConfig } from "../../integrations/shared/types.ts";

// Test fixtures - valid integration
const validIntegration: Integration = {
  name: "test-framework",
  version: "1.0.0",
  async render(params) {
    return {
      html: "<div>Test</div>",
      hydrationData: { src: params.src, props: params.props },
    };
  },
  getHydrationScript() {
    return "console.log('hydrate');";
  },
  config() {
    return {
      name: "test-framework",
      fileExtensions: [".test"],
      detectionPatterns: {
        imports: [/^test-framework$/],
        content: [/\btest\b/],
      },
    };
  },
};

// Test fixtures - valid integration with optional vitePlugin
const validIntegrationWithPlugin: Integration = {
  ...validIntegration,
  vitePlugin() {
    return { name: "test-plugin" };
  },
};

// Test fixtures - valid config
const validConfig: IntegrationConfig = {
  name: "test-framework",
  fileExtensions: [".test", ".tsx"],
  jsxImportSources: ["test-framework"],
  detectionPatterns: {
    imports: [/^test-framework$/, /^test-framework\//],
    content: [/\btest\b/, /\bTestComponent\b/],
  },
};

Deno.test("Integration Validation - Valid Cases", async (t) => {
  await t.step("should validate a complete valid integration", () => {
    const result = validateIntegration(validIntegration);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  await t.step("should validate integration with optional vitePlugin", () => {
    const result = validateIntegration(validIntegrationWithPlugin);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  await t.step("should allow warnings without invalidating", () => {
    const integration = {
      ...validIntegration,
      config() {
        return {
          name: "test",
          fileExtensions: ["test"], // Missing dot - should warn
          detectionPatterns: {
            imports: [],
            content: [],
          },
        };
      },
    };
    const result = validateIntegration(integration);
    assertEquals(result.valid, true);
    assertEquals(result.warnings.length > 0, true);
  });
});

Deno.test("Integration Validation - Invalid Cases", async (t) => {
  await t.step("should reject non-object integration", () => {
    const result = validateIntegration(null);
    assertEquals(result.valid, false);
    assertEquals(result.errors.includes("Integration must be an object"), true);
  });

  await t.step("should reject integration without name", () => {
    const integration = { ...validIntegration };
    delete (integration as any).name;
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("name")),
      true
    );
  });

  await t.step("should reject integration without version", () => {
    const integration = { ...validIntegration };
    delete (integration as any).version;
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("version")),
      true
    );
  });

  await t.step("should reject integration without render method", () => {
    const integration = { ...validIntegration };
    delete (integration as any).render;
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("render")),
      true
    );
  });

  await t.step("should reject integration without getHydrationScript method", () => {
    const integration = { ...validIntegration };
    delete (integration as any).getHydrationScript;
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("getHydrationScript")),
      true
    );
  });

  await t.step("should reject integration without config method", () => {
    const integration = { ...validIntegration };
    delete (integration as any).config;
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("config")),
      true
    );
  });

  await t.step("should reject integration with invalid vitePlugin type", () => {
    const integration = {
      ...validIntegration,
      vitePlugin: "not a function",
    };
    const result = validateIntegration(integration);
    assertEquals(result.valid, true); // Still valid, but should have warning
    assertEquals(
      result.warnings.some((w) => w.includes("vitePlugin")),
      true
    );
  });

  await t.step("should reject integration with config that throws error", () => {
    const integration = {
      ...validIntegration,
      config() {
        throw new Error("Config error");
      },
    };
    const result = validateIntegration(integration);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("Config error")),
      true
    );
  });
});

Deno.test("Integration Config Validation - Valid Cases", async (t) => {
  await t.step("should validate complete valid config", () => {
    const result = validateIntegrationConfig(validConfig);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  await t.step("should validate minimal valid config", () => {
    const config: IntegrationConfig = {
      name: "minimal",
      fileExtensions: [".min"],
      detectionPatterns: {
        imports: [],
        content: [],
      },
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, true);
  });

  await t.step("should validate config without optional fields", () => {
    const config = {
      name: "test",
      fileExtensions: [".test"],
      detectionPatterns: {
        imports: [/test/],
        content: [/test/],
      },
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, true);
  });
});

Deno.test("Integration Config Validation - Invalid Cases", async (t) => {
  await t.step("should reject non-object config", () => {
    const result = validateIntegrationConfig(null);
    assertEquals(result.valid, false);
    assertEquals(result.errors.includes("Integration config must be an object"), true);
  });

  await t.step("should reject config without name", () => {
    const config = { ...validConfig };
    delete (config as any).name;
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("name")),
      true
    );
  });

  await t.step("should reject config without fileExtensions", () => {
    const config = { ...validConfig };
    delete (config as any).fileExtensions;
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("fileExtensions")),
      true
    );
  });

  await t.step("should reject config with non-array fileExtensions", () => {
    const config = {
      ...validConfig,
      fileExtensions: "not an array",
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("fileExtensions")),
      true
    );
  });

  await t.step("should warn about empty fileExtensions", () => {
    const config = {
      ...validConfig,
      fileExtensions: [],
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, true);
    assertEquals(
      result.warnings.some((w) => w.includes("empty")),
      true
    );
  });

  await t.step("should reject config with non-string fileExtension", () => {
    const config = {
      ...validConfig,
      fileExtensions: [".test", 123],
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("fileExtensions[1]")),
      true
    );
  });

  await t.step("should warn about fileExtension without dot", () => {
    const config = {
      ...validConfig,
      fileExtensions: ["test"],
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, true);
    assertEquals(
      result.warnings.some((w) => w.includes("dot")),
      true
    );
  });

  await t.step("should reject config with non-array jsxImportSources", () => {
    const config = {
      ...validConfig,
      jsxImportSources: "not an array",
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("jsxImportSources")),
      true
    );
  });

  await t.step("should reject config with non-object detectionPatterns", () => {
    const config = {
      ...validConfig,
      detectionPatterns: "not an object",
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("detectionPatterns")),
      true
    );
  });

  await t.step("should reject config with non-array detectionPatterns.imports", () => {
    const config = {
      ...validConfig,
      detectionPatterns: {
        imports: "not an array",
        content: [],
      },
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("detectionPatterns.imports")),
      true
    );
  });

  await t.step("should reject config with non-RegExp in detectionPatterns.imports", () => {
    const config = {
      ...validConfig,
      detectionPatterns: {
        imports: [/valid/, "not a regex"],
        content: [],
      },
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("detectionPatterns.imports[1]")),
      true
    );
  });

  await t.step("should reject config with non-RegExp in detectionPatterns.content", () => {
    const config = {
      ...validConfig,
      detectionPatterns: {
        imports: [],
        content: [/valid/, "not a regex"],
      },
    };
    const result = validateIntegrationConfig(config);
    assertEquals(result.valid, false);
    assertEquals(
      result.errors.some((e) => e.includes("detectionPatterns.content[1]")),
      true
    );
  });
});

Deno.test("Multiple Integrations Validation", async (t) => {
  await t.step("should validate multiple valid integrations", () => {
    const integration2 = {
      ...validIntegrationWithPlugin,
      name: "test-framework-2",
      config() {
        return {
          name: "test-framework-2",
          fileExtensions: [".test2"],
          detectionPatterns: {
            imports: [/^test-framework-2$/],
            content: [/\btest2\b/],
          },
        };
      },
    };
    
    const integrations = [
      validIntegration,
      integration2,
    ];
    const result = validateIntegrations(integrations);
    assertEquals(result.valid, true);
    assertEquals(result.results.size, 2);
  });

  await t.step("should detect invalid integration in batch", () => {
    const invalidIntegration = { 
      ...validIntegration,
      name: "invalid-framework",
    };
    delete (invalidIntegration as any).render;
    
    const integrations = [
      validIntegration,
      invalidIntegration,
    ];
    const result = validateIntegrations(integrations);
    assertEquals(result.valid, false);
    assertEquals(result.results.size, 2);
    
    const invalidResult = result.results.get("invalid-framework");
    assertExists(invalidResult);
    assertEquals(invalidResult.valid, false);
  });

  await t.step("should use index for unnamed integrations", () => {
    const integrations = [
      { name: "test" },
      { noName: true },
    ];
    const result = validateIntegrations(integrations);
    assertEquals(result.results.has("test"), true);
    assertEquals(result.results.has("integration-1"), true);
  });
});

Deno.test("Assert Valid Integration", async (t) => {
  await t.step("should not throw for valid integration", () => {
    let error = null;
    try {
      assertValidIntegration(validIntegration);
    } catch (e) {
      error = e;
    }
    assertEquals(error, null);
  });

  await t.step("should throw for invalid integration", () => {
    const invalidIntegration = { ...validIntegration };
    delete (invalidIntegration as any).render;
    
    let error: Error | null = null;
    try {
      assertValidIntegration(invalidIntegration);
    } catch (e) {
      error = e as Error;
    }
    
    assertExists(error);
    assertEquals(error.message.includes("validation failed"), true);
    assertEquals(error.message.includes("render"), true);
  });
});

Deno.test("Format Validation Result", async (t) => {
  await t.step("should format valid result", () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };
    const formatted = formatValidationResult(result);
    assertEquals(formatted.includes("✓"), true);
    assertEquals(formatted.includes("valid"), true);
  });

  await t.step("should format invalid result with errors", () => {
    const result: ValidationResult = {
      valid: false,
      errors: ["Error 1", "Error 2"],
      warnings: [],
    };
    const formatted = formatValidationResult(result);
    assertEquals(formatted.includes("✗"), true);
    assertEquals(formatted.includes("Error 1"), true);
    assertEquals(formatted.includes("Error 2"), true);
  });

  await t.step("should format result with warnings", () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: ["Warning 1", "Warning 2"],
    };
    const formatted = formatValidationResult(result);
    assertEquals(formatted.includes("Warning 1"), true);
    assertEquals(formatted.includes("Warning 2"), true);
  });

  await t.step("should format result with both errors and warnings", () => {
    const result: ValidationResult = {
      valid: false,
      errors: ["Error 1"],
      warnings: ["Warning 1"],
    };
    const formatted = formatValidationResult(result);
    assertEquals(formatted.includes("Error 1"), true);
    assertEquals(formatted.includes("Warning 1"), true);
  });
});
