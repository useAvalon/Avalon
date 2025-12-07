# Build System Integration Support

This document describes how the Avalon build system handles framework integrations, including detection, bundling, and optimization.

## Overview

The build system automatically detects which framework integrations are used in your project and only bundles the necessary code. This tree-shaking approach ensures optimal bundle sizes and faster builds.

## Architecture

### Integration Detection

The build system scans your project files to detect which frameworks are being used:

- **File Extensions**: `.vue` files indicate Vue, `.svelte` files indicate Svelte
- **Import Analysis**: TSX/JSX files are analyzed for framework-specific imports
- **Content Analysis**: File contents are checked for framework-specific patterns

Detection happens in the `integration-detection-plugin.ts` which runs during the build start phase.

### Module Resolution

Integration packages use the `@avalon/integration-*` naming convention:

```typescript
import { preactIntegration } from '@avalon/integration-preact';
import { vueIntegration } from '@avalon/integration-vue/server';
```

The `integration-resolver-plugin.ts` handles resolving these imports to the actual file paths:

- `@avalon/integration-preact` → `src/integrations/preact/mod.ts`
- `@avalon/integration-preact/server` → `src/integrations/preact/server/renderer.ts`
- `@avalon/integration-preact/client` → `src/integrations/preact/client/index.ts`

### Build Configurations

#### Client Build (vite.config.ts)

The client build:
- Detects used integrations
- Bundles client-side hydration code for each integration
- Optimizes dependencies based on detected integrations
- Includes island component bundles

#### SSR Build (vite.ssr.config.ts)

The SSR build:
- Bundles server-side rendering code for each integration
- Includes island SSR bundles
- Configures SSR externals appropriately
- Outputs to `dist/ssr/`

### Integration Bundling

The `integration-bundler-plugin.ts` handles:

1. **Entry Points**: Adds integration server/client code as build entry points
2. **Code Splitting**: Ensures integration code is properly chunked
3. **Tree Shaking**: Only includes integrations that are actually used

## Build Process

The build process follows these steps:

1. **Integration Detection**: Scan project files to detect used frameworks
2. **Manifest Generation**: Create island manifest with framework metadata
3. **Client Build**: Bundle client-side code with integration hydration
4. **SSR Build**: Bundle server-side code with integration renderers

```bash
deno run --allow-all build.ts
```

### Build Steps

```
🔧 Detecting integrations
📦 Generating island manifest
🏗️ Running Vite build (client)
🔨 Building SSR bundles
```

## Configuration

### Integration Build Config

Each integration has a build configuration in `src/build/integration-config.ts`:

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

### Adding a New Integration

To add support for a new framework integration:

1. Create the integration package in `src/integrations/[framework]/`
2. Add build configuration to `INTEGRATION_BUILD_CONFIGS`
3. Update detection logic in `integration-detection-plugin.ts`
4. Add framework plugin loading if needed

## Optimization

### Dependency Optimization

The build system optimizes dependencies based on detected integrations:

```typescript
optimizeDeps: {
  include: [
    // Only includes deps for used integrations
    ...getIntegrationOptimizeDeps(requiredIntegrations),
  ],
}
```

### Tree Shaking

Unused integrations are completely excluded from the build:

- No integration code is bundled if not used
- Framework dependencies are not included
- Vite plugins are not loaded

### Code Splitting

Integration code is split into separate chunks:

- `integrations/[framework]/client.js` - Client hydration code
- `integrations/[framework]/server.js` - SSR rendering code
- `islands/[name].js` - Individual island bundles

## SSR Configuration

### noExternal Packages

Framework packages that must be bundled for SSR:

- **Vue**: `vue`, `@vue/server-renderer`, `@vue/shared`
- **Svelte**: `svelte`, `svelte/server`, `svelte/internal`
- **Solid**: `solid-js`
- **Preact**: `preact`, `preact-render-to-string`

These are configured per-integration in `integration-config.ts`.

## Development vs Production

### Development Mode

- Integrations are loaded dynamically via Vite dev server
- Hot module replacement works for all frameworks
- Source maps are generated
- No minification

### Production Mode

- Integrations are pre-bundled
- Code is minified and optimized
- Source maps are optional
- Island manifest is generated for efficient loading

## Troubleshooting

### Integration Not Detected

If an integration isn't being detected:

1. Check file extensions match the integration config
2. Verify imports are using the correct framework packages
3. Check that files are in scanned directories (`islands/`, `components/`, `src/`)

### Build Errors

Common build errors:

- **Missing Plugin**: Install the required Vite plugin for the framework
- **Module Resolution**: Check that integration aliases are configured
- **SSR Errors**: Verify SSR noExternal configuration includes framework packages

### Bundle Size Issues

To reduce bundle size:

1. Only use integrations you need
2. Remove unused framework imports
3. Check that tree-shaking is working (unused integrations should not be in bundle)

## Performance

### Build Time

Integration detection adds minimal overhead:
- File scanning: ~10-50ms
- Plugin initialization: ~5-20ms per integration

### Bundle Size

Each integration adds approximately:
- **Preact**: ~4KB (client) + ~8KB (server)
- **Vue**: ~10KB (client) + ~15KB (server)
- **Solid**: ~7KB (client) + ~10KB (server)
- **Svelte**: ~5KB (client) + ~12KB (server)

These are gzipped sizes for the integration wrapper code only, not including the framework itself.

## Future Improvements

Planned enhancements:

1. **Lazy Loading**: Load integration code only when needed
2. **Parallel Builds**: Build integrations in parallel
3. **Caching**: Cache integration bundles between builds
4. **Analysis**: Provide bundle size analysis per integration
