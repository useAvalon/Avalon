/**
 * Nitro v3 Runtime Configuration Module for Avalon
 *
 * This module provides runtime configuration support for the Nitro v3 integration,
 * including environment variable overrides with NITRO_ prefix and a
 * useRuntimeConfig() function for accessing configuration in handlers.
 *
 * Note: The 'nitro' namespace in runtimeConfig is reserved by Nitro v3
 * and must not be used by application code.
 *
 * Requirements: 5.1, 5.2, 5.3, 11.4
 */

/**
 * Avalon-specific runtime configuration stored in Nitro v3's runtimeConfig.
 * This is accessed via useRuntimeConfig().avalon in handlers.
 * The 'avalon' namespace is used to avoid conflict with the reserved 'nitro' namespace.
 */
export interface AvalonRuntimeConfig {
  /** Enable streaming SSR responses */
  streaming: boolean;
  /** Pages directory path relative to project root */
  pagesDir: string;
  /** API directory path relative to project root */
  apiDir: string;
  /** Islands directory path relative to project root */
  islandsDir: string;
}

/**
 * Runtime configuration structure
 * Contains both public (client-accessible) and private (server-only) config
 */
export interface RuntimeConfig {
  /** Avalon-specific runtime configuration */
  avalon: AvalonRuntimeConfig;
  /** Public configuration (exposed to client) */
  public?: Record<string, unknown>;
  /** Additional custom configuration */
  [key: string]: unknown;
}

/**
 * Environment variable prefix for runtime config overrides
 */
export const NITRO_ENV_PREFIX = "NITRO_";

/**
 * Public config environment variable prefix
 */
export const NITRO_PUBLIC_ENV_PREFIX = "NITRO_PUBLIC_";

/**
 * Global runtime config storage
 * This is populated during server initialization
 */
let _runtimeConfig: RuntimeConfig | null = null;

/**
 * Sets the global runtime configuration
 * This should be called during server initialization
 *
 * @param config - The runtime configuration to set
 */
export function setRuntimeConfig(config: RuntimeConfig): void {
  _runtimeConfig = config;
}

/**
 * Gets the current runtime configuration (Nitro v3 compatible).
 * Applies environment variable overrides on each access.
 *
 * Requirements: 5.1, 5.2
 *
 * @returns The runtime configuration with environment overrides applied
 * @throws Error if runtime config has not been initialized
 *
 * @example
 * ```ts
 * const config = useRuntimeConfig();
 * console.log(config.avalon.streaming); // Access Avalon config
 * console.log(config.apiKey); // Access custom config
 * ```
 */
export function useRuntimeConfig(): RuntimeConfig {
  if (!_runtimeConfig) {
    throw new Error(
      "Runtime configuration not initialized. " +
      "Ensure setRuntimeConfig() is called during server startup."
    );
  }

  // Apply environment variable overrides
  return applyEnvOverrides(_runtimeConfig);
}

/**
 * Gets a specific runtime config value by key path
 * Supports dot notation for nested values
 *
 * @param keyPath - The key path (e.g., "avalon.streaming" or "apiKey")
 * @param defaultValue - Default value if key is not found
 * @returns The config value or default
 *
 * @example
 * ```ts
 * const streaming = getRuntimeConfigValue("avalon.streaming", true);
 * const apiKey = getRuntimeConfigValue("apiKey", "");
 * ```
 */
export function getRuntimeConfigValue<T>(
  keyPath: string,
  defaultValue?: T
): T | undefined {
  const config = useRuntimeConfig();
  const keys = keyPath.split(".");
  
  let current: unknown = config;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    if (typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}

/**
 * Applies environment variable overrides to runtime config.
 * Environment variables with NITRO_ prefix override corresponding config values.
 * This is compatible with Nitro v3's environment variable override mechanism.
 *
 * Requirements: 5.2
 *
 * @param config - The base runtime configuration
 * @returns Configuration with environment overrides applied
 *
 * @example
 * Environment variable mapping:
 * - NITRO_API_KEY -> config.apiKey
 * - NITRO_AVALON_STREAMING -> config.avalon.streaming
 * - NITRO_PUBLIC_APP_NAME -> config.public.appName
 */
export function applyEnvOverrides(config: RuntimeConfig): RuntimeConfig {
  // Create a deep copy to avoid mutating the original
  const result = deepClone(config);

  // Get environment variables
  const env = getEnvironmentVariables();

  // Process NITRO_ prefixed variables
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(NITRO_PUBLIC_ENV_PREFIX)) {
      // Handle public config: NITRO_PUBLIC_* -> config.public.*
      const configKey = envKeyToConfigKey(key.slice(NITRO_PUBLIC_ENV_PREFIX.length));
      if (!result.public) {
        result.public = {};
      }
      setNestedValue(result.public, configKey, parseEnvValue(value));
    } else if (key.startsWith(NITRO_ENV_PREFIX)) {
      // Handle private config: NITRO_* -> config.*
      const configKey = envKeyToConfigKey(key.slice(NITRO_ENV_PREFIX.length));
      setNestedValue(result, configKey, parseEnvValue(value));
    }
  }

  return result;
}

/**
 * Converts an environment variable key to a config key path
 * Handles underscore-separated keys and converts to camelCase
 *
 * @param envKey - The environment variable key (without NITRO_ prefix)
 * @returns The config key path
 *
 * @example
 * - "API_KEY" -> "apiKey"
 * - "AVALON_STREAMING" -> "avalon.streaming"
 * - "DATABASE_URL" -> "databaseUrl"
 */
export function envKeyToConfigKey(envKey: string): string {
  // Split by double underscore for nested paths
  const parts = envKey.split("__");
  
  return parts
    .map((part) => {
      // Convert SCREAMING_SNAKE_CASE to camelCase
      return part
        .toLowerCase()
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    })
    .join(".");
}

/**
 * Converts a config key path to an environment variable key
 *
 * @param configKey - The config key path (e.g., "avalon.streaming")
 * @returns The environment variable key (e.g., "NITRO_AVALON__STREAMING")
 */
export function configKeyToEnvKey(configKey: string): string {
  const parts = configKey.split(".");
  
  return NITRO_ENV_PREFIX + parts
    .map((part) => {
      // Convert camelCase to SCREAMING_SNAKE_CASE
      return part
        .replace(/([A-Z])/g, "_$1")
        .toUpperCase()
        .replace(/^_/, "");
    })
    .join("__");
}

/**
 * Parses an environment variable value to the appropriate type
 *
 * @param value - The string value from environment
 * @returns Parsed value (boolean, number, or string)
 */
export function parseEnvValue(value: string | undefined): unknown {
  if (value === undefined) {
    return undefined;
  }

  // Handle boolean values
  if (value.toLowerCase() === "true") {
    return true;
  }
  if (value.toLowerCase() === "false") {
    return false;
  }

  // Handle numeric values
  const numValue = Number(value);
  if (!isNaN(numValue) && value.trim() !== "") {
    return numValue;
  }

  // Handle JSON values (arrays and objects)
  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, return as string
    }
  }

  // Return as string
  return value;
}

/**
 * Sets a nested value in an object using dot notation path
 *
 * @param obj - The object to modify
 * @param path - The dot-notation path (e.g., "avalon.streaming")
 * @param value - The value to set
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
}

/**
 * Gets a nested value from an object using dot notation path
 *
 * @param obj - The object to read from
 * @param path - The dot-notation path
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Deep clones an object
 *
 * @param obj - The object to clone
 * @returns A deep copy of the object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }

  return cloned as T;
}

/**
 * Gets environment variables from the runtime environment
 * Supports both Deno and Node.js environments
 *
 * @returns Record of environment variables
 */
export function getEnvironmentVariables(): Record<string, string> {
  // Check for Deno environment
  if (typeof Deno !== "undefined" && Deno.env) {
    return Object.fromEntries(Deno.env.toObject ? 
      Object.entries(Deno.env.toObject()) : 
      []
    );
  }

  // Check for Node.js environment
  // Use globalThis to avoid TypeScript errors in Deno
  const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (globalProcess?.env) {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(globalProcess.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    return env;
  }

  // Fallback: empty object
  return {};
}

/**
 * Creates a default runtime configuration
 *
 * @param avalonConfig - Avalon-specific configuration
 * @param additionalConfig - Additional custom configuration
 * @returns Complete runtime configuration
 */
export function createDefaultRuntimeConfig(
  avalonConfig: Partial<AvalonRuntimeConfig> = {},
  additionalConfig: Record<string, unknown> = {}
): RuntimeConfig {
  return {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
      ...avalonConfig,
    },
    public: {},
    ...additionalConfig,
  };
}

/**
 * Validates runtime configuration structure
 *
 * @param config - The configuration to validate
 * @returns Validation result with any errors
 */
export function validateRuntimeConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    errors.push("Runtime config must be an object");
    return { valid: false, errors };
  }

  const cfg = config as Record<string, unknown>;

  // Check for required avalon config
  if (!cfg.avalon || typeof cfg.avalon !== "object") {
    errors.push("Runtime config must have an 'avalon' object");
  } else {
    const avalon = cfg.avalon as Record<string, unknown>;
    
    if (typeof avalon.streaming !== "boolean") {
      errors.push("avalon.streaming must be a boolean");
    }
    if (typeof avalon.pagesDir !== "string") {
      errors.push("avalon.pagesDir must be a string");
    }
    if (typeof avalon.apiDir !== "string") {
      errors.push("avalon.apiDir must be a string");
    }
    if (typeof avalon.islandsDir !== "string") {
      errors.push("avalon.islandsDir must be a string");
    }
  }

  // Nitro v3: The 'nitro' namespace in runtimeConfig is reserved
  if ("nitro" in cfg) {
    errors.push(
      'The "nitro" key in runtimeConfig is reserved by Nitro v3 and cannot be used'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merges multiple runtime configurations
 * Later configs override earlier ones
 *
 * @param configs - Array of configurations to merge
 * @returns Merged configuration
 */
export function mergeRuntimeConfigs(
  ...configs: Partial<RuntimeConfig>[]
): RuntimeConfig {
  const result: RuntimeConfig = {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    public: {},
  };

  for (const config of configs) {
    if (!config) continue;

    // Merge avalon config
    if (config.avalon) {
      result.avalon = {
        ...result.avalon,
        ...config.avalon,
      };
    }

    // Merge public config
    if (config.public) {
      result.public = {
        ...result.public,
        ...config.public,
      };
    }

    // Merge other keys (excluding reserved 'nitro' namespace in v3)
    for (const [key, value] of Object.entries(config)) {
      if (key !== "avalon" && key !== "public" && key !== "nitro") {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Initializes runtime configuration from Nitro v3 config output.
 * This should be called during server startup.
 *
 * @param nitroConfig - The Nitro v3 configuration output
 */
export function initializeRuntimeConfig(nitroConfig: {
  runtimeConfig?: {
    avalon?: Partial<AvalonRuntimeConfig>;
    [key: string]: unknown;
  };
  publicRuntimeConfig?: Record<string, unknown>;
}): void {
  const config = createDefaultRuntimeConfig(
    nitroConfig.runtimeConfig?.avalon,
    nitroConfig.runtimeConfig
  );

  if (nitroConfig.publicRuntimeConfig) {
    config.public = nitroConfig.publicRuntimeConfig;
  }

  setRuntimeConfig(config);
}

/**
 * Resets the runtime configuration (useful for testing)
 */
export function resetRuntimeConfig(): void {
  _runtimeConfig = null;
}

/**
 * Checks if runtime configuration has been initialized
 *
 * @returns True if config is initialized
 */
export function isRuntimeConfigInitialized(): boolean {
  return _runtimeConfig !== null;
}
