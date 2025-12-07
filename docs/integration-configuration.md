# Integration Configuration System

The Avalon integration configuration system allows you to manage framework integrations through a centralized configuration file. This provides control over which integrations are loaded, validation settings, and auto-discovery behavior.

## Configuration File

Create an `avalon.config.ts` file in your project root:

```typescript
/**
 * Avalon Framework Configuration
 */

export default {
  /**
   * Framework integrations to register
   * Avalon will load these integrations on startup
   */
  integrations: [
    { name: "preact", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
  ],

  /**
   * Auto-discover integrations from component usage
   * When true, Avalon will automatically load integrations
   * based on the components you use, even if not listed above
   */
  autoDiscoverIntegrations: true,

  /**
   * Validate integrations on startup
   * When true, Avalon will check that all integrations
   * implement the required interface correctly
   */
  validateIntegrations: true,

  /**
   * Show warnings for integration issues
   * When true, Avalon will log warnings for non-critical
   * integration problems
   */
  showWarnings: true,
};
```

## Configuration Options

### `integrations`

An array of integration configuration entries. Each entry specifies:

- `name` (required): The name of the integration (e.g., "preact", "vue", "solid", "svelte")
- `enabled` (optional): Whether the integration is enabled (default: true)
- `options` (optional): Custom options for the integration

Example:

```typescript
integrations: [
  { name: "preact", enabled: true },
  { name: "vue", enabled: false }, // Disabled
  { 
    name: "solid", 
    enabled: true,
    options: { 
      // Custom options for Solid integration
    }
  },
]
```

### `autoDiscoverIntegrations`

When `true` (default), Avalon will automatically load integrations based on the components you use, even if they're not explicitly listed in the `integrations` array.

This is useful for development where you want to quickly try different frameworks without updating the config file.

Set to `false` for production builds to ensure only explicitly configured integrations are loaded.

### `validateIntegrations`

When `true` (default), Avalon validates that all loaded integrations implement the required interface correctly during startup.

This helps catch integration issues early and ensures compatibility.

### `showWarnings`

When `true` (default), Avalon logs warnings for non-critical integration issues.

Set to `false` to suppress warnings in production.

## CLI Commands

Avalon provides CLI commands for managing integrations:

### List Integrations

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts list
```

Shows all configured integrations and their status.

Add `--verbose` or `-v` for detailed output:

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts list --verbose
```

### Initialize Integration System

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts init
```

Initializes the integration system and validates all integrations.

Add `--verbose` or `-v` for detailed validation results:

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts init --verbose
```

### Validate Integrations

Validate all integrations:

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts validate
```

Validate a specific integration:

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts validate preact
```

### Show Integration Info

```bash
deno run --allow-read --allow-env src/core/integrations/cli.ts info preact
```

Shows detailed information about a specific integration, including:
- Version
- File extensions
- JSX import sources
- Detection patterns
- Available methods
- Validation status

### Generate Config File

```bash
deno run --allow-read --allow-write src/core/integrations/cli.ts generate-config
```

Generates a default `avalon.config.ts` file in the current directory.

Add `--force` or `-f` to overwrite an existing file:

```bash
deno run --allow-read --allow-write src/core/integrations/cli.ts generate-config --force
```

## Programmatic Usage

### Initialize Integrations

```typescript
import { initializeIntegrations } from "./src/core/integrations/startup.ts";

const result = await initializeIntegrations();

if (result.success) {
  console.log("Integrations loaded:", result.loadedIntegrations);
} else {
  console.error("Errors:", result.errors);
}
```

### Load Configuration

```typescript
import { loadConfig } from "./src/core/integrations/config-loader.ts";

const configResult = await loadConfig();

if (configResult.found) {
  console.log("Config loaded from:", configResult.configPath);
  console.log("Integrations:", configResult.config.integrations);
}
```

### List Integrations

```typescript
import { listIntegrations } from "./src/core/integrations/startup.ts";

const integrations = await listIntegrations();

integrations.forEach(info => {
  console.log(`${info.name}: ${info.loaded ? "loaded" : "not loaded"}`);
});
```

### Load Integration

```typescript
import { loadIntegration } from "./src/islands/integration-loader.ts";

try {
  const integration = await loadIntegration("preact");
  console.log("Loaded:", integration.name, integration.version);
} catch (error) {
  console.error("Failed to load integration:", error.message);
}
```

## Error Messages

The configuration system provides helpful error messages for common issues:

### Missing Integration

```
Integration 'vue' is not loaded.

To fix this, add it to your avalon.config.ts:

  export default {
    integrations: [
      { name: "vue", enabled: true },
    ],
  };

Or enable auto-discovery:

  export default {
    autoDiscoverIntegrations: true,
  };

Make sure the integration package is installed:
  deno add @avalon/integration-vue
```

### Misconfigured Integration

```
Integration 'preact' is misconfigured.

Validation errors:
  - Integration must have a 'render' method
  - Integration must have a 'config' method

Please check your integration implementation or update to the latest version.
```

### Invalid Configuration

```
Config validation failed:
  - integrations[0].name must be a string
  - autoDiscoverIntegrations must be a boolean
```

## Best Practices

### Development

For development, enable auto-discovery for flexibility:

```typescript
export default {
  autoDiscoverIntegrations: true,
  validateIntegrations: true,
  showWarnings: true,
};
```

### Production

For production, explicitly list integrations and disable auto-discovery:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
    // Only list integrations you actually use
  ],
  autoDiscoverIntegrations: false,
  validateIntegrations: true,
  showWarnings: false,
};
```

### Custom Integrations

To use custom integrations, add them to the config:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
    { name: "my-custom-framework", enabled: true },
  ],
};
```

Make sure your custom integration:
1. Implements the `Integration` interface
2. Is located at `src/integrations/my-custom-framework/mod.ts`
3. Exports a `myCustomFrameworkIntegration` object

## Troubleshooting

### Config File Not Found

If your config file isn't being found:

1. Make sure it's named `avalon.config.ts` (or `.js`, `.mjs`)
2. Place it in your project root or a parent directory
3. Check file permissions

### Integration Not Loading

If an integration isn't loading:

1. Check that it's enabled in the config: `{ name: "preact", enabled: true }`
2. Verify the integration package is installed
3. Run validation: `deno run --allow-read --allow-env src/core/integrations/cli.ts validate`
4. Check for error messages in the console

### Validation Errors

If you see validation errors:

1. Run `deno run --allow-read --allow-env src/core/integrations/cli.ts info <integration-name>` to see details
2. Update the integration to the latest version
3. Check the integration's README for compatibility notes

## API Reference

### Types

```typescript
interface AvalonConfig {
  integrations?: IntegrationConfigEntry[];
  autoDiscoverIntegrations?: boolean;
  validateIntegrations?: boolean;
  showWarnings?: boolean;
}

interface IntegrationConfigEntry {
  name: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

interface InitializationResult {
  success: boolean;
  config: ConfigLoadResult;
  loadedIntegrations: string[];
  failedIntegrations: Map<string, string>;
  validationResults: Map<string, ValidationResult>;
  errors: string[];
  warnings: string[];
}

interface IntegrationInfo {
  name: string;
  loaded: boolean;
  version?: string;
  valid?: boolean;
  enabled?: boolean;
  configEntry?: IntegrationConfigEntry;
}
```

### Functions

```typescript
// Load configuration
function loadConfig(startDir?: string): Promise<ConfigLoadResult>

// Initialize integrations
function initializeIntegrations(startDir?: string): Promise<InitializationResult>

// List integrations
function listIntegrations(startDir?: string): Promise<IntegrationInfo[]>

// Load a specific integration
function loadIntegration(framework: string): Promise<Integration>

// Validate integration
function validateIntegration(integration: unknown): ValidationResult

// Format results
function formatInitializationResult(result: InitializationResult): string
function formatIntegrationList(integrations: IntegrationInfo[]): string

// Error messages
function getMissingIntegrationError(framework: string): string
function getMisconfiguredIntegrationError(framework: string, errors: string[]): string
```
