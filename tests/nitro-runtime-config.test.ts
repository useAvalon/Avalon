/**
 * Tests for Nitro Runtime Configuration Module
 *
 * Tests the runtime configuration support including:
 * - Environment variable overrides with NITRO_ prefix
 * - useRuntimeConfig() function
 * - Configuration merging and validation
 *
 * Requirements: 8.3
 */

import { assertEquals, assertThrows, assertExists } from "jsr:@std/assert";
import {
  useRuntimeConfig,
  setRuntimeConfig,
  resetRuntimeConfig,
  getRuntimeConfigValue,
  applyEnvOverrides,
  envKeyToConfigKey,
  configKeyToEnvKey,
  parseEnvValue,
  setNestedValue,
  getNestedValue,
  deepClone,
  createDefaultRuntimeConfig,
  validateRuntimeConfig,
  mergeRuntimeConfigs,
  initializeRuntimeConfig,
  isRuntimeConfigInitialized,
  NITRO_ENV_PREFIX,
  NITRO_PUBLIC_ENV_PREFIX,
  type RuntimeConfig,
} from "../packages/avalon/src/nitro/runtime-config.ts";

// Reset config before each test
function setup() {
  resetRuntimeConfig();
}

Deno.test("Runtime Config - setRuntimeConfig and useRuntimeConfig", () => {
  setup();

  const config: RuntimeConfig = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    public: {},
    customKey: "customValue",
  };

  setRuntimeConfig(config);
  const result = useRuntimeConfig();

  assertEquals(result.avalon.streaming, true);
  assertEquals(result.avalon.pagesDir, "src/pages");
  assertEquals(result.customKey, "customValue");
});

Deno.test("Runtime Config - useRuntimeConfig throws when not initialized", () => {
  setup();

  assertThrows(
    () => useRuntimeConfig(),
    Error,
    "Runtime configuration not initialized"
  );
});

Deno.test("Runtime Config - getRuntimeConfigValue with dot notation", () => {
  setup();

  const config: RuntimeConfig = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    public: {
      appName: "TestApp",
    },
    nested: {
      deep: {
        value: 42,
      },
    },
  };

  setRuntimeConfig(config);

  assertEquals(getRuntimeConfigValue("avalon.streaming"), true);
  assertEquals(getRuntimeConfigValue("avalon.pagesDir"), "src/pages");
  assertEquals(getRuntimeConfigValue("public.appName"), "TestApp");
  assertEquals(getRuntimeConfigValue("nested.deep.value"), 42);
  assertEquals(getRuntimeConfigValue("nonexistent", "default"), "default");
});

Deno.test("Runtime Config - envKeyToConfigKey conversion", () => {
  // Simple keys
  assertEquals(envKeyToConfigKey("API_KEY"), "apiKey");
  assertEquals(envKeyToConfigKey("DATABASE_URL"), "databaseUrl");

  // Nested keys with double underscore
  assertEquals(envKeyToConfigKey("AVALON__STREAMING"), "avalon.streaming");
  assertEquals(envKeyToConfigKey("PUBLIC__APP_NAME"), "public.appName");

  // Single word
  assertEquals(envKeyToConfigKey("PORT"), "port");
});

Deno.test("Runtime Config - configKeyToEnvKey conversion", () => {
  assertEquals(configKeyToEnvKey("apiKey"), "NITRO_API_KEY");
  assertEquals(configKeyToEnvKey("databaseUrl"), "NITRO_DATABASE_URL");
  assertEquals(configKeyToEnvKey("avalon.streaming"), "NITRO_AVALON__STREAMING");
  assertEquals(configKeyToEnvKey("port"), "NITRO_PORT");
});

Deno.test("Runtime Config - parseEnvValue handles different types", () => {
  // Boolean values
  assertEquals(parseEnvValue("true"), true);
  assertEquals(parseEnvValue("false"), false);
  assertEquals(parseEnvValue("TRUE"), true);
  assertEquals(parseEnvValue("FALSE"), false);

  // Numeric values
  assertEquals(parseEnvValue("42"), 42);
  assertEquals(parseEnvValue("3.14"), 3.14);
  assertEquals(parseEnvValue("-10"), -10);

  // String values
  assertEquals(parseEnvValue("hello"), "hello");
  assertEquals(parseEnvValue(""), "");

  // JSON values
  assertEquals(parseEnvValue('{"key":"value"}'), { key: "value" });
  assertEquals(parseEnvValue("[1,2,3]"), [1, 2, 3]);

  // Invalid JSON returns string
  assertEquals(parseEnvValue("{invalid}"), "{invalid}");

  // Undefined
  assertEquals(parseEnvValue(undefined), undefined);
});

Deno.test("Runtime Config - setNestedValue", () => {
  const obj: Record<string, unknown> = {};

  setNestedValue(obj, "simple", "value");
  assertEquals(obj.simple, "value");

  setNestedValue(obj, "nested.deep.value", 42);
  assertEquals((obj.nested as Record<string, unknown>).deep, { value: 42 });

  setNestedValue(obj, "nested.another", "test");
  assertEquals(
    (obj.nested as Record<string, unknown>).another,
    "test"
  );
});

Deno.test("Runtime Config - getNestedValue", () => {
  const obj = {
    simple: "value",
    nested: {
      deep: {
        value: 42,
      },
    },
  };

  assertEquals(getNestedValue(obj, "simple"), "value");
  assertEquals(getNestedValue(obj, "nested.deep.value"), 42);
  assertEquals(getNestedValue(obj, "nested.deep"), { value: 42 });
  assertEquals(getNestedValue(obj, "nonexistent"), undefined);
  assertEquals(getNestedValue(obj, "nested.nonexistent"), undefined);
});

Deno.test("Runtime Config - deepClone creates independent copy", () => {
  const original = {
    string: "hello",
    number: 42,
    boolean: true,
    array: [1, 2, 3],
    nested: {
      value: "nested",
    },
  };

  const cloned = deepClone(original);

  // Values should be equal
  assertEquals(cloned, original);

  // But objects should be different references
  cloned.nested.value = "modified";
  assertEquals(original.nested.value, "nested");

  cloned.array.push(4);
  assertEquals(original.array.length, 3);
});

Deno.test("Runtime Config - createDefaultRuntimeConfig", () => {
  const config = createDefaultRuntimeConfig();

  assertEquals(config.avalon.streaming, true);
  assertEquals(config.avalon.pagesDir, "src/pages");
  assertEquals(config.avalon.apiDir, "src/api");
  assertEquals(config.avalon.islandsDir, "src/islands");
  assertExists(config.public);
});

Deno.test("Runtime Config - createDefaultRuntimeConfig with overrides", () => {
  const config = createDefaultRuntimeConfig(
    { streaming: false, pagesDir: "custom/pages" },
    { apiKey: "secret123" }
  );

  assertEquals(config.avalon.streaming, false);
  assertEquals(config.avalon.pagesDir, "custom/pages");
  assertEquals(config.apiKey, "secret123");
});

Deno.test("Runtime Config - validateRuntimeConfig valid config", () => {
  const config: RuntimeConfig = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
  };

  const result = validateRuntimeConfig(config);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("Runtime Config - validateRuntimeConfig invalid config", () => {
  const invalidConfigs = [
    null,
    undefined,
    "string",
    { noAvalon: true },
    { avalon: "notAnObject" },
    { avalon: { streaming: "notBoolean" } },
  ];

  for (const config of invalidConfigs) {
    const result = validateRuntimeConfig(config);
    assertEquals(result.valid, false);
  }
});

Deno.test("Runtime Config - mergeRuntimeConfigs", () => {
  const config1: Partial<RuntimeConfig> = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    apiKey: "key1",
  };

  const config2: Partial<RuntimeConfig> = {
    avalon: {
      streaming: false,
      pagesDir: "custom/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    databaseUrl: "postgres://localhost",
  };

  const merged = mergeRuntimeConfigs(config1, config2);

  // Later config overrides earlier
  assertEquals(merged.avalon.streaming, false);
  assertEquals(merged.avalon.pagesDir, "custom/pages");

  // Both custom keys preserved
  assertEquals(merged.apiKey, "key1");
  assertEquals(merged.databaseUrl, "postgres://localhost");
});

Deno.test("Runtime Config - initializeRuntimeConfig", () => {
  setup();

  initializeRuntimeConfig({
    runtimeConfig: {
      avalon: {
        streaming: false,
      },
      customKey: "customValue",
    },
    publicRuntimeConfig: {
      appName: "TestApp",
    },
  });

  const config = useRuntimeConfig();
  assertEquals(config.avalon.streaming, false);
  assertEquals(config.customKey, "customValue");
  assertEquals(config.public?.appName, "TestApp");
});

Deno.test("Runtime Config - isRuntimeConfigInitialized", () => {
  setup();

  assertEquals(isRuntimeConfigInitialized(), false);

  setRuntimeConfig(createDefaultRuntimeConfig());

  assertEquals(isRuntimeConfigInitialized(), true);
});

Deno.test("Runtime Config - NITRO_ENV_PREFIX constant", () => {
  assertEquals(NITRO_ENV_PREFIX, "NITRO_");
});

Deno.test("Runtime Config - NITRO_PUBLIC_ENV_PREFIX constant", () => {
  assertEquals(NITRO_PUBLIC_ENV_PREFIX, "NITRO_PUBLIC_");
});

Deno.test("Runtime Config - applyEnvOverrides preserves base config", () => {
  const baseConfig: RuntimeConfig = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    public: {},
    existingKey: "existingValue",
  };

  // applyEnvOverrides should not mutate the original
  const result = applyEnvOverrides(baseConfig);

  // Original should be unchanged
  assertEquals(baseConfig.existingKey, "existingValue");

  // Result should have the same base values
  assertEquals(result.avalon.streaming, true);
  assertEquals(result.existingKey, "existingValue");
});
