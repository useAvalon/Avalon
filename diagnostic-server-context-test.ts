#!/usr/bin/env -S deno run --allow-all

/**
 * Diagnostic script to test renderIsland in server context
 * This simulates the server environment where Vite is available
 */

console.log('🔍 Starting server context diagnostic...\n');

// Change to Avalon directory to use the correct import mapping
const originalCwd = Deno.cwd();
Deno.chdir('./Avalon');

try {
	console.log('📋 Test 1: Import createServer and start minimal server');
	const { createServer } = await import('@avalon/avalon');
	console.log('✅ createServer imported successfully');

	// Create a minimal server configuration
	const serverConfig = {
		routes: {},
		port: 8001, // Use different port to avoid conflicts
		defaultOptions: {
			title: 'Diagnostic Test',
		},
		fileSystemRouting: {
			enabled: false, // Disable for this test
		},
	};

	console.log('📋 Test 2: Start server to initialize Vite');
	const server = await createServer(serverConfig);
	console.log('✅ Server created successfully');

	// Give the server a moment to fully initialize
	await new Promise(resolve => setTimeout(resolve, 2000));

	console.log('📋 Test 3: Check if Vite server is now available globally');
	if (globalThis.__viteDevServer) {
		console.log('✅ Vite dev server is available globally');
		console.log('✅ ssrLoadModule available:', typeof globalThis.__viteDevServer.ssrLoadModule);
	} else {
		console.log('❌ Vite dev server still not available globally');
	}

	console.log('📋 Test 4: Test renderIsland with Vite server available');
	const { renderIsland } = await import('@avalon/avalon');

	try {
		const result = await renderIsland({
			src: '/islands/PreactCounter.tsx',
			condition: 'on:client',
			ssr: true,
			props: { initialCount: 42 },
		});

		console.log('✅ renderIsland with SSR test completed');
		console.log('✅ Result type:', typeof result);

		// Check if we got SSR content
		if (result && typeof result === 'object' && 'props' in result) {
			const props = result.props as any;
			if (props && props.dangerouslySetInnerHTML) {
				console.log('✅ SSR content detected in result');
				console.log('✅ SSR HTML length:', props.dangerouslySetInnerHTML.__html?.length || 0);
			} else if (props && props.children) {
				console.log('✅ SSR children detected in result');
			} else {
				console.log('⚠️ No SSR content detected - likely fell back to client-only');
			}
		}
	} catch (error) {
		console.error('❌ renderIsland test failed:', error.message);
	}

	console.log('📋 Test 5: Shutdown server');
	await server.shutdown();
	console.log('✅ Server shutdown complete');
} catch (error) {
	console.error('❌ Server context test failed:', error);
} finally {
	Deno.chdir(originalCwd);
}

console.log('\n🎯 Server Context Diagnostic Complete');
