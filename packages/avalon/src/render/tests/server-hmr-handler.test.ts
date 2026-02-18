/**
 * Tests for ServerHMRHandler
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import { ServerHMRHandler } from '../server-hmr-handler.ts';

// Mock ViteDevServer for testing
function createMockViteServer() {
  const sentMessages: Array<{ type: string; event?: string; data?: unknown; path?: string }> = [];
  const invalidatedModules: string[] = [];

  return {
    sentMessages,
    invalidatedModules,
    ws: {
      send: (message: unknown) => {
        sentMessages.push(message as { type: string; event?: string; data?: unknown; path?: string });
      },
    },
    watcher: {
      on: (_event: string, _callback: (path: string) => void) => {
        // Mock watcher - does nothing in tests
      },
    },
    moduleGraph: {
      getModuleByUrl: async (_url: string) => null,
      getModuleById: (_id: string) => null,
      invalidateModule: (_module: unknown) => {
        // Track invalidation
      },
    },
  };
}

describe('ServerHMRHandler - initialization', () => {
  it('should create handler with default config', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });
    expect(handler).toBeDefined();
  });

  it('should create handler with custom config', () => {
    const customHandler = new ServerHMRHandler({
      debugLogging: true,
      errorHandling: {
        keepAlive: false,
        displayInBrowser: false,
      },
    });
    expect(customHandler).toBeDefined();
  });
});

describe('ServerHMRHandler - statistics', () => {
  it('should return initial stats', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });

    const stats = handler.getStats();
    expect(stats.totalInvalidations).toEqual(0);
    expect(stats.cachedErrors).toEqual(0);
    expect(stats.recentInvalidations.length).toEqual(0);
  });

  it('should clear caches', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });

    handler.clearCaches();
    const stats = handler.getStats();
    expect(stats.totalInvalidations).toEqual(0);
    expect(stats.cachedErrors).toEqual(0);
  });
});

describe('ServerHMRHandler - error caching', () => {
  it('should cache and retrieve errors', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });

    const modulePath = '/test/module.ts';

    // Initially no error
    expect(handler.getCachedError(modulePath)).toEqual(undefined);

    // Clear error (should not throw)
    handler.clearCachedError(modulePath);

    // Verify still no error
    expect(handler.getCachedError(modulePath)).toEqual(undefined);
  });

  it('should get invalidation timestamp', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });

    const modulePath = '/test/module.ts';
    expect(handler.getInvalidationTimestamp(modulePath)).toEqual(undefined);
  });
});

describe('ServerHMRHandler - page update triggers browser refresh', () => {
  it('should send full-reload on page update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();

    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);

    const result = await handler.handlePageUpdate('/src/pages/index.tsx');

    expect(result.success).toEqual(true);
    expect(result.invalidatedModules.length).toEqual(1);

    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    expect(fullReloadMessage).toBeDefined();
    expect(fullReloadMessage!.path).toEqual('/src/pages/index.tsx');
  });
});

describe('ServerHMRHandler - layout update triggers browser refresh', () => {
  it('should send full-reload on layout update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();

    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);

    const result = await handler.handleLayoutUpdate('/src/layouts/_layout.tsx');

    expect(result.success).toEqual(true);

    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    expect(fullReloadMessage).toBeDefined();
    expect(fullReloadMessage!.path).toEqual('/src/layouts/_layout.tsx');
  });
});

describe('ServerHMRHandler - API route update sends custom event', () => {
  it('should send custom event on API route update (no full reload)', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();

    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);

    const result = await handler.handleAPIRouteUpdate('/src/api/hello.ts');

    expect(result.success).toEqual(true);
    expect(result.invalidatedModules.length).toEqual(1);

    const customMessage = mockServer.sentMessages.find(m => m.type === 'custom');
    expect(customMessage).toBeDefined();
    expect(customMessage!.event).toEqual('avalon:api-route-updated');

    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    expect(fullReloadMessage).toEqual(undefined);
  });
});

describe('ServerHMRHandler - middleware update triggers browser refresh', () => {
  it('should send full-reload on middleware update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();

    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);

    const result = await handler.handleMiddlewareUpdate('/src/middleware/_middleware.ts');

    expect(result.success).toEqual(true);
    expect(result.warnings.length).toEqual(1);
    expect(result.warnings[0]).toEqual('Middleware chain will be rebuilt on next request');

    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    expect(fullReloadMessage).toBeDefined();
    expect(fullReloadMessage!.path).toEqual('/src/middleware/_middleware.ts');
  });
});
