# Avalon Build System

This directory contains the build system components for Avalon, including integration detection, bundling, and optimization.

## Components

### Integration Detection (`integration-detection-plugin.ts`)

Automatically detects which framework integrations are used in your project by:
- Scanning file extensions (`.vue`, `.svelte`)
- Analyzing imports in TSX/JSX files
- Detecting framework-specific patterns

**Usage:**
```typescript
import { detectUsedIntegrations, getRequiredIntegrations } from './integration-detection-plugin.ts';

const detected = await detectUsedIntegrations();
const required = getRequiredIntegrations(detected);
// required = ['preact', 'vue', 'solid', 'svelte']
```

### Integration Resolver (`integration-resolver-plugin.ts`)

Resolves `@useavalon/integration-*` imports to actual file paths:

```typescript
// Import resolution
'@useavalon/integration-preact' → 'src/integrations/preact/mod.ts'
'@useavalon/integration-preact/server' → 'src/integrations/preact/server/renderer.ts'
'@useavalon/integration-preact/client' → 'src/integrations/preact/client/index.ts'
```

**Usage:**
```typescript
import { integrationResolverPlugin, createIntegrationAliases } from './integration-resolver-plugin.ts';

// In Vite config
plugins: [
  integrationResolverPlugin(),
]

// Or use aliases
resolve: {
  alias: createIntegrationAliases(),
}
```

### Integration Bundler (`integration-bundler-plugin.ts`)

Handles bundling of integration packages for both client and SSR builds:

**Usage:**
```typescript
import { integrationBundlerPlugin } from './integration-bundler-plugin.ts';

// Client build
plugins: [
  integrationBundlerPlugin({ 
    integrations: ['preact', 'vue'], 
    ssr: false 
  }),
]

// SSR build
plugins: [
  integrationBundlerPlugin({ 
    integrations: ['preact', 'vue'], 
    ssr: true 
  }),
]
```

### Integration Config (`integration-config.ts`)

Centralized configuration for all framework integrations:

```typescript
export interface IntegrationBuildConfig {
  name: string;
  extensions: string[];
  optimizeDeps: string[];
  ssrExternal: string[];
  ssrNoExternal: string[];
  requiresPlugin: boolean;
  pluginPackage?: string;
}
```

**Usage:**
```typescript
import { 
  getIntegrationBuildConfig,
  getOptimizeDepsForIntegrations,
  getSSRNoExternalForIntegrations 
} from './integration-config.ts';

const config = getIntegrationBuildConfig('preact');
const optimizeDeps = getOptimizeDepsForIntegrations(['preact', 'vue']);
const ssrNoExternal = getSSRNoExternalForIntegrations(['preact', 'vue']);
```

### Island Manifest (`island-manifest.ts`)

Generates a manifest of all islands with their framework types and bundle paths:

```typescript
export interface IslandManifest {
  islands: Record<string, IslandEntry>;
  version: string;
  buildTime: number;
}

export interface IslandEntry {
  src: string;
  bundle: string;
  hash: string;
  framework: 'preact' | 'solid' | 'vue' | 'svelte' | 'vanilla';
  deps: string[];
}
```

**Usage:**
```typescript
import { generateIslandManifest, loadIslandManifest } from './island-manifest.ts';

// During build
const manifest = await generateIslandManifest();
await Deno.writeTextFile('dist/island-manifest.json', JSON.stringify(manifest));

// At runtime
const manifest = await loadIslandManifest();
const bundlePath = getIslandBundlePath('/islands/Counter.tsx', manifest);
```

### MDX Plugin (`mdx-plugin.ts`)

Handles MDX file processing with support for framework components.

## Build Configurations

### Main Build (`vite.config.ts`)

Client-side build configuration:
- Detects used integrations
- Bundles client hydration code
- Optimizes dependencies
- Includes island bundles

### SSR Build (`vite.ssr.config.ts`)

Server-side rendering build configuration:
- Bundles SSR rendering code
- Includes island SSR bundles
- Configures SSR externals
- Outputs to `dist/ssr/`

## Build Process

The build process is orchestrated by `build.ts`:

1. **Integration Detection**: Scan project to detect frameworks
2. **Manifest Generation**: Create island manifest
3. **Client Build**: Bundle client code with Vite
4. **SSR Build**: Bundle SSR code with Vite SSR config

```bash
deno run --allow-all build.ts
```

## Tree Shaking

The build system automatically tree-shakes unused integrations:

- Only detected integrations are bundled
- Framework dependencies are excluded if not used
- Vite plugins are only loaded for used frameworks

**Example:**
```
Project uses: Preact, Vue
Build includes: preact integration, vue integration
Build excludes: solid integration, svelte integration
```

## Testing

Test integration detection:
```bash
deno run --allow-read test-integration-detection.ts
```

Expected output:
```
🔍 Testing integration detection...

Detected integrations:
  Preact: ✅
  Vue: ✅
  Solid: ✅
  Svelte: ✅

Required integrations: preact, vue, solid, svelte

✅ Integration detection test complete!
```

## Adding a New Integration

To add support for a new framework:

1. **Create Integration Package**
   ```
   src/integrations/[framework]/
   ├── mod.ts
   ├── server/
   │   └── renderer.ts
   ├── client/
   │   └── index.ts
   └── types.ts
   ```

2. **Add Build Configuration**
   ```typescript
   // In integration-config.ts
   export const INTEGRATION_BUILD_CONFIGS = {
     // ...
     myframework: {
       name: 'myframework',
       extensions: ['.myext'],
       optimizeDeps: ['myframework'],
       ssrExternal: [],
       ssrNoExternal: ['myframework'],
       requiresPlugin: true,
       pluginPackage: 'vite-plugin-myframework',
     },
   };
   ```

3. **Update Detection Logic**
   ```typescript
   // In integration-detection-plugin.ts
   export async function detectUsedIntegrations() {
     const result = {
       // ...
       myframework: false,
     };
     
     // Add detection logic
     if (entry.name.endsWith('.myext')) {
       result.myframework = true;
     }
     
     return result;
   }
   ```

4. **Add Resolver Aliases**
   ```typescript
   // In integration-resolver-plugin.ts
   export function createIntegrationAliases() {
     return {
       // ...
       '@useavalon/integration-myframework': resolve(cwd, 'src/integrations/myframework/mod.ts'),
     };
   }
   ```

## Performance

### Build Time Impact

- Integration detection: ~10-50ms
- Plugin initialization: ~5-20ms per integration
- Total overhead: <100ms for typical projects

### Bundle Size Impact

Per-integration overhead (gzipped):
- Preact: ~4KB (client) + ~8KB (server)
- Vue: ~10KB (client) + ~15KB (server)
- Solid: ~7KB (client) + ~10KB (server)
- Svelte: ~5KB (client) + ~12KB (server)

## Troubleshooting

### Integration Not Detected

Check:
1. File extensions match integration config
2. Files are in scanned directories
3. Imports use correct framework packages

### Build Errors

Common issues:
- Missing Vite plugin: Install required plugin
- Module resolution: Check integration aliases
- SSR errors: Verify SSR noExternal config

### Bundle Size

To optimize:
1. Remove unused framework imports
2. Verify tree-shaking is working
3. Check that only used integrations are bundled

## Documentation

See [docs/build-system-integrations.md](../../docs/build-system-integrations.md) for detailed documentation.
