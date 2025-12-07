# Integration System

The Avalon integration system provides a modular, extensible architecture for framework integrations. Each framework (Preact, Vue, Solid, Svelte) is an independent package with its own versioning and dependencies.

## Architecture

```
src/core/integrations/
├── registry.ts          # Integration registry for managing loaded integrations
├── loader.ts            # Dynamic integration loading with caching
├── validator.ts         # Integration validation and compliance checking
├── config-loader.ts     # Configuration file loading and parsing
├── startup.ts           # System initialization and validation
├── cli.ts               # CLI commands for managing integrations
└── index.ts             # Public API exports
```

## Key Components

### Registry (`registry.ts`)

The `IntegrationRegistry` manages loaded framework integrations:

```typescript
import { registry } from "./src/core/integrations/registry.ts";

// Load an integration
const integration = await registry.load("preact");

// Check if loaded
if (registry.has("preact")) {
  const preact = registry.get("preact");
}

// Get all loaded integrations
const all = registry.getAll();
```

### Loader (`loader.ts`)

Dynamic integration loading with caching:

```typescript
import { loadIntegration } from "./src/core/integrations/loader.ts";

// Load integration (cached)
const integration = await loadIntegration("vue");

// Preload multiple integrations
await preloadIntegrations(["preact", "vue", "solid"]);

// Check if loaded
if (isIntegrationLoaded("svelte")) {
  // ...
}
```

### Validator (`validator.ts`)

Validate integrations against the required interface:

```typescript
import { validateIntegration } from "./src/core/integrations/validator.ts";

const result = validateIntegration(integration);

if (result.valid) {
  console.log("Integration is valid");
} else {
  console.error("Errors:", result.errors);
  console.warn("Warnings:", result.warnings);
}
```

### Configuration (`config-loader.ts`)

Load and parse `avalon.config.ts`:

```typescript
import { loadConfig } from "./src/core/integrations/config-loader.ts";

const result = await loadConfig();

if (result.found) {
  console.log("Config:", result.config);
  console.log("Path:", result.configPath);
}
```

### Startup (`startup.ts`)

Initialize the integration system:

```typescript
import { initializeIntegrations } from "./src/core/integrations/startup.ts";

const result = await initializeIntegrations();

if (result.success) {
  console.log("Loaded:", result.loadedIntegrations);
} else {
  console.error("Errors:", result.errors);
}
```

## Configuration

Create an `avalon.config.ts` file in your project root:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
  ],
  autoDiscoverIntegrations: true,
  validateIntegrations: true,
  showWarnings: true,
};
```

See [Integration Configuration](../../../docs/integration-configuration.md) for full documentation.

## CLI Commands

```bash
# List integrations
deno run --allow-read --allow-env src/core/integrations/cli.ts list

# Initialize system
deno run --allow-read --allow-env src/core/integrations/cli.ts init

# Validate integrations
deno run --allow-read --allow-env src/core/integrations/cli.ts validate

# Show integration info
deno run --allow-read --allow-env src/core/integrations/cli.ts info preact

# Generate config file
deno run --allow-read --allow-write src/core/integrations/cli.ts generate-config
```

## Error Handling

The system provides helpful error messages:

### Missing Integration

```typescript
try {
  await loadIntegration("vue");
} catch (error) {
  // Error includes installation instructions
  console.error(error.message);
}
```

### Validation Errors

```typescript
const result = validateIntegration(integration);

if (!result.valid) {
  // Detailed error messages
  result.errors.forEach(error => console.error(error));
}
```

### Configuration Errors

```typescript
const config = await loadConfig();

if (config.errors.length > 0) {
  // Configuration validation errors
  config.errors.forEach(error => console.error(error));
}
```

## Integration Discovery

The system supports multiple discovery methods:

### 1. Explicit Configuration

List integrations in `avalon.config.ts`:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
  ],
};
```

### 2. Auto-Discovery

Enable auto-discovery to load integrations based on usage:

```typescript
export default {
  autoDiscoverIntegrations: true,
};
```

### 3. Manual Loading

Load integrations programmatically:

```typescript
import { loadIntegration } from "./src/core/integrations/loader.ts";

const integration = await loadIntegration("solid");
```

## Validation

Integrations are validated to ensure they implement the required interface:

```typescript
interface Integration {
  name: string;
  version: string;
  render(params: RenderParams): Promise<RenderResult>;
  getHydrationScript(): string;
  config(): IntegrationConfig;
  vitePlugin?(): any | any[];
}
```

Validation checks:
- Required properties exist and have correct types
- Required methods are functions
- Configuration is valid
- Detection patterns are RegExp objects

## Best Practices

### Development

```typescript
export default {
  autoDiscoverIntegrations: true,  // Flexible
  validateIntegrations: true,       // Catch issues early
  showWarnings: true,               // See all issues
};
```

### Production

```typescript
export default {
  integrations: [
    // Only list what you use
    { name: "preact", enabled: true },
  ],
  autoDiscoverIntegrations: false,  // Explicit control
  validateIntegrations: true,       // Ensure compatibility
  showWarnings: false,              // Clean logs
};
```

## Testing

Test the configuration system:

```bash
deno run --allow-read --allow-env src/core/integrations/test-config.ts
```

## API Reference

See [Integration Configuration](../../../docs/integration-configuration.md) for complete API documentation.

## Related Documentation

- [Integration System Design](../../../.kiro/specs/framework-integrations/design.md)
- [Integration Requirements](../../../.kiro/specs/framework-integrations/requirements.md)
- [Integration Configuration](../../../docs/integration-configuration.md)
- [Creating Custom Integrations](../../../docs/custom-integrations.md)
