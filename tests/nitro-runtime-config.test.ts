/**
 * Tests for Nitro v3 Runtime Configuration Module
 *
 * Tests the runtime configuration support including:
 * - Environment variable overrides with NITRO_ prefix
 * - useRuntimeConfig() function (Nitro v3 compatible)
 * - Configuration merging and validation
 * - Reserved 'nitro' namespace protection (v3 constraint)
 *
 * Requirements: 5.1, 5.2, 5.3, 11.4
 */

import { describe, it, expect } from 'vitest';
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

describe('Runtime Config - setRuntimeConfig and useRuntimeConfig', () => {
  it('should set and retrieve runtime config', () => {
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

    expect(result.avalon.streaming).toEqual(true);
    expect(result.avalon.pagesDir).toEqual("src/pages");
    expect(result.customKey).toEqual("customValue");
  });

  it('should throw when not initialized', () => {
    setup();

    expect(() => useRuntimeConfig()).toThrow("Runtime configuration not initialized");
  });
});

describe('Runtime Config - getRuntimeConfigValue with dot notation', () => {
  it('should access nested values with dot notation', () => {
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

    expect(getRuntimeConfigValue("avalon.streaming")).toEqual(true);
    expect(getRuntimeConfigValue("avalon.pagesDir")).toEqual("src/pages");
    expect(getRuntimeConfigValue("public.appName")).toEqual("TestApp");
    expect(getRuntimeConfigValue("nested.deep.value")).toEqual(42);
    expect(getRuntimeConfigValue("nonexistent", "default")).toEqual("default");
  });
});

describe('Runtime Config - envKeyToConfigKey conversion', () => {
  it('should convert env keys to config keys', () => {
    expect(envKeyToConfigKey("API_KEY")).toEqual("apiKey");
    expect(envKeyToConfigKey("DATABASE_URL")).toEqual("databaseUrl");
    expect(envKeyToConfigKey("AVALON__STREAMING")).toEqual("avalon.streaming");
    expect(envKeyToConfigKey("PUBLIC__APP_NAME")).toEqual("public.appName");
    expect(envKeyToConfigKey("PORT")).toEqual("port");
  });
});

describe('Runtime Config - configKeyToEnvKey conversion', () => {
  it('should convert config keys to env keys', () => {
    expect(configKeyToEnvKey("apiKey")).toEqual("NITRO_API_KEY");
    expect(configKeyToEnvKey("databaseUrl")).toEqual("NITRO_DATABASE_URL");
    expect(configKeyToEnvKey("avalon.streaming")).toEqual("NITRO_AVALON__STREAMING");
    expect(configKeyToEnvKey("port")).toEqual("NITRO_PORT");
  });
});

describe('Runtime Config - parseEnvValue', () => {
  it('should handle different value types', () => {
    expect(parseEnvValue("true")).toEqual(true);
    expect(parseEnvValue("false")).toEqual(false);
    expect(parseEnvValue("TRUE")).toEqual(true);
    expect(parseEnvValue("FALSE")).toEqual(false);

    expect(parseEnvValue("42")).toEqual(42);
    expect(parseEnvValue("3.14")).toEqual(3.14);
    expect(parseEnvValue("-10")).toEqual(-10);

    expect(parseEnvValue("hello")).toEqual("hello");
    expect(parseEnvValue("")).toEqual("");

    expect(parseEnvValue('{"key":"value"}')).toEqual({ key: "value" });
    expect(parseEnvValue("[1,2,3]")).toEqual([1, 2, 3]);

    expect(parseEnvValue("{invalid}")).toEqual("{invalid}");

    expect(parseEnvValue(undefined)).toEqual(undefined);
  });
});

describe('Runtime Config - setNestedValue', () => {
  it('should set nested values', () => {
    const obj: Record<string, unknown> = {};

    setNestedValue(obj, "simple", "value");
    expect(obj.simple).toEqual("value");

    setNestedValue(obj, "nested.deep.value", 42);
    expect((obj.nested as Record<string, unknown>).deep).toEqual({ value: 42 });

    setNestedValue(obj, "nested.another", "test");
    expect((obj.nested as Record<string, unknown>).another).toEqual("test");
  });
});

describe('Runtime Config - getNestedValue', () => {
  it('should get nested values', () => {
    const obj = {
      simple: "value",
      nested: {
        deep: {
          value: 42,
        },
      },
    };

    expect(getNestedValue(obj, "simple")).toEqual("value");
    expect(getNestedValue(obj, "nested.deep.value")).toEqual(42);
    expect(getNestedValue(obj, "nested.deep")).toEqual({ value: 42 });
    expect(getNestedValue(obj, "nonexistent")).toEqual(undefined);
    expect(getNestedValue(obj, "nested.nonexistent")).toEqual(undefined);
  });
});

describe('Runtime Config - deepClone', () => {
  it('should create independent copy', () => {
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

    expect(cloned).toEqual(original);

    cloned.nested.value = "modified";
    expect(original.nested.value).toEqual("nested");

    cloned.array.push(4);
    expect(original.array.length).toEqual(3);
  });
});

describe('Runtime Config - createDefaultRuntimeConfig', () => {
  it('should create default config', () => {
    const config = createDefaultRuntimeConfig();

    expect(config.avalon.streaming).toEqual(true);
    expect(config.avalon.pagesDir).toEqual("src/pages");
    expect(config.avalon.apiDir).toEqual("src/api");
    expect(config.avalon.islandsDir).toEqual("src/islands");
    expect(config.public).toBeDefined();
  });

  it('should accept overrides', () => {
    const config = createDefaultRuntimeConfig(
      { streaming: false, pagesDir: "custom/pages" },
      { apiKey: "secret123" }
    );

    expect(config.avalon.streaming).toEqual(false);
    expect(config.avalon.pagesDir).toEqual("custom/pages");
    expect(config.apiKey).toEqual("secret123");
  });
});

describe('Runtime Config - validateRuntimeConfig', () => {
  it('should validate valid config', () => {
    const config: RuntimeConfig = {
      avalon: {
        streaming: true,
        pagesDir: "src/pages",
        apiDir: "src/api",
        islandsDir: "src/islands",
      },
    };

    const result = validateRuntimeConfig(config);
    expect(result.valid).toEqual(true);
    expect(result.errors.length).toEqual(0);
  });

  it('should reject invalid configs', () => {
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
      expect(result.valid).toEqual(false);
    }
  });

  it('should reject reserved nitro namespace', () => {
    const config = {
      avalon: {
        streaming: true,
        pagesDir: "src/pages",
        apiDir: "src/api",
        islandsDir: "src/islands",
      },
      nitro: { someKey: "value" },
    };

    const result = validateRuntimeConfig(config);
    expect(result.valid).toEqual(false);
    expect(result.errors.some((e: string) => e.includes("nitro") && e.includes("reserved"))).toEqual(true);
  });
});

describe('Runtime Config - mergeRuntimeConfigs', () => {
  it('should merge configs with later overriding earlier', () => {
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

    expect(merged.avalon.streaming).toEqual(false);
    expect(merged.avalon.pagesDir).toEqual("custom/pages");
    expect(merged.apiKey).toEqual("key1");
    expect(merged.databaseUrl).toEqual("postgres://localhost");
  });

  it('should ignore reserved nitro namespace', () => {
    const config1: Partial<RuntimeConfig> = {
      avalon: {
        streaming: true,
        pagesDir: "src/pages",
        apiDir: "src/api",
        islandsDir: "src/islands",
      },
    };

    const config2: Partial<RuntimeConfig> = {
      avalon: {
        streaming: true,
        pagesDir: "src/pages",
        apiDir: "src/api",
        islandsDir: "src/islands",
      },
      nitro: { reserved: true },
    } as Partial<RuntimeConfig>;

    const merged = mergeRuntimeConfigs(config1, config2);
    expect("nitro" in merged).toEqual(false);
  });
});

describe('Runtime Config - initializeRuntimeConfig', () => {
  it('should initialize config', () => {
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
    expect(config.avalon.streaming).toEqual(false);
    expect(config.customKey).toEqual("customValue");
    expect(config.public?.appName).toEqual("TestApp");
  });
});

describe('Runtime Config - isRuntimeConfigInitialized', () => {
  it('should track initialization state', () => {
    setup();

    expect(isRuntimeConfigInitialized()).toEqual(false);

    setRuntimeConfig(createDefaultRuntimeConfig());

    expect(isRuntimeConfigInitialized()).toEqual(true);
  });
});

describe('Runtime Config - Constants', () => {
  it('should have correct prefix constants', () => {
    expect(NITRO_ENV_PREFIX).toEqual("NITRO_");
    expect(NITRO_PUBLIC_ENV_PREFIX).toEqual("NITRO_PUBLIC_");
  });
});

describe('Runtime Config - applyEnvOverrides', () => {
  it('should preserve base config', () => {
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

    const result = applyEnvOverrides(baseConfig);

    expect(baseConfig.existingKey).toEqual("existingValue");
    expect(result.avalon.streaming).toEqual(true);
    expect(result.existingKey).toEqual("existingValue");
  });
});
