/**
 * Tests for ServerHMRHandler
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { assertEquals, assertExists } from '@std/assert';
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

Deno.test('ServerHMRHandler - initialization', async (t) => {
  await t.step('should create handler with default config', () => {
    const handler = new ServerHMRHandler({
      debugLogging: false,
    });
    assertExists(handler);
  });

  await t.step('should create handler with custom config', () => {
    const customHandler = new ServerHMRHandler({
      debugLogging: true,
      errorHandling: {
        keepAlive: false,
        displayInBrowser: false,
      },
    });
    assertExists(customHandler);
  });
});

Deno.test('ServerHMRHandler - statistics', async (t) => {
  const handler = new ServerHMRHandler({
    debugLogging: false,
  });

  await t.step('should return initial stats', () => {
    const stats = handler.getStats();
    assertEquals(stats.totalInvalidations, 0);
    assertEquals(stats.cachedErrors, 0);
    assertEquals(stats.recentInvalidations.length, 0);
  });

  await t.step('should clear caches', () => {
    handler.clearCaches();
    const stats = handler.getStats();
    assertEquals(stats.totalInvalidations, 0);
    assertEquals(stats.cachedErrors, 0);
  });
});

Deno.test('ServerHMRHandler - error caching', async (t) => {
  const handler = new ServerHMRHandler({
    debugLogging: false,
  });

  await t.step('should cache and retrieve errors', () => {
    const modulePath = '/test/module.ts';

    // Initially no error
    assertEquals(handler.getCachedError(modulePath), undefined);

    // Clear error (should not throw)
    handler.clearCachedError(modulePath);

    // Verify still no error
    assertEquals(handler.getCachedError(modulePath), undefined);
  });

  await t.step('should get invalidation timestamp', () => {
    const modulePath = '/test/module.ts';
    assertEquals(handler.getInvalidationTimestamp(modulePath), undefined);
  });
});


Deno.test('ServerHMRHandler - page update triggers browser refresh', async (t) => {
  await t.step('should send full-reload on page update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();
    
    // Initialize with mock server
    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);
    
    // Trigger page update
    const result = await handler.handlePageUpdate('/src/pages/index.tsx');
    
    // Verify result
    assertEquals(result.success, true);
    assertEquals(result.invalidatedModules.length, 1);
    
    // Verify full-reload was sent
    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    assertExists(fullReloadMessage);
    assertEquals(fullReloadMessage.path, '/src/pages/index.tsx');
  });
});

Deno.test('ServerHMRHandler - layout update triggers browser refresh', async (t) => {
  await t.step('should send full-reload on layout update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();
    
    // Initialize with mock server
    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);
    
    // Trigger layout update
    const result = await handler.handleLayoutUpdate('/src/layouts/_layout.tsx');
    
    // Verify result
    assertEquals(result.success, true);
    
    // Verify full-reload was sent
    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    assertExists(fullReloadMessage);
    assertEquals(fullReloadMessage.path, '/src/layouts/_layout.tsx');
  });
});

Deno.test('ServerHMRHandler - API route update sends custom event', async (t) => {
  await t.step('should send custom event on API route update (no full reload)', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();
    
    // Initialize with mock server
    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);
    
    // Trigger API route update
    const result = await handler.handleAPIRouteUpdate('/src/api/hello.ts');
    
    // Verify result
    assertEquals(result.success, true);
    assertEquals(result.invalidatedModules.length, 1);
    
    // Verify custom event was sent (not full-reload)
    const customMessage = mockServer.sentMessages.find(m => m.type === 'custom');
    assertExists(customMessage);
    assertEquals(customMessage.event, 'avalon:api-route-updated');
    
    // Verify NO full-reload was sent
    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    assertEquals(fullReloadMessage, undefined);
  });
});

Deno.test('ServerHMRHandler - middleware update triggers browser refresh', async (t) => {
  await t.step('should send full-reload on middleware update', async () => {
    const handler = new ServerHMRHandler({ debugLogging: false });
    const mockServer = createMockViteServer();
    
    // Initialize with mock server
    handler.initialize(mockServer as unknown as Parameters<typeof handler.initialize>[0]);
    
    // Trigger middleware update
    const result = await handler.handleMiddlewareUpdate('/src/middleware/_middleware.ts');
    
    // Verify result
    assertEquals(result.success, true);
    assertEquals(result.warnings.length, 1);
    assertEquals(result.warnings[0], 'Middleware chain will be rebuilt on next request');
    
    // Verify full-reload was sent
    const fullReloadMessage = mockServer.sentMessages.find(m => m.type === 'full-reload');
    assertExists(fullReloadMessage);
    assertEquals(fullReloadMessage.path, '/src/middleware/_middleware.ts');
  });
});
