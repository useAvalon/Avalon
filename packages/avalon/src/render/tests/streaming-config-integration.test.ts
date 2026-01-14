/**
 * Integration tests for streaming configuration
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { assertEquals, assertExists } from '@std/assert';
import { validateServerConfig } from '../../schemas/server.ts';

Deno.test('Streaming configuration integration', async (t) => {
	await t.step('should enable streaming by default', () => {
		const config = {
			routes: {
				'/': {
					component: () => 'Hello',
					options: {},
				},
			},
			port: 8001,
		};

		const validated = validateServerConfig(config);

		assertExists(validated.streaming);
		assertEquals(validated.streaming.enabled, true);
		assertEquals(validated.streaming.onShellReadyTimeout, 5000);
		assertEquals(validated.streaming.onAllReadyTimeout, 30000);
	});

	await t.step('should allow disabling streaming for backward compatibility', () => {
		const config = {
			routes: {
				'/': {
					component: () => 'Hello',
					options: {},
				},
			},
			port: 8001,
			streaming: {
				enabled: false,
			},
		};

		const validated = validateServerConfig(config);

		assertExists(validated.streaming);
		assertEquals(validated.streaming.enabled, false);
	});

	await t.step('should allow custom timeout values', () => {
		const config = {
			routes: {
				'/': {
					component: () => 'Hello',
					options: {},
				},
			},
			port: 8001,
			streaming: {
				enabled: true,
				onShellReadyTimeout: 10000,
				onAllReadyTimeout: 60000,
			},
		};

		const validated = validateServerConfig(config);

		assertExists(validated.streaming);
		assertEquals(validated.streaming.enabled, true);
		assertEquals(validated.streaming.onShellReadyTimeout, 10000);
		assertEquals(validated.streaming.onAllReadyTimeout, 60000);
	});

	await t.step('should use defaults when streaming config is partially provided', () => {
		const config = {
			routes: {
				'/': {
					component: () => 'Hello',
					options: {},
				},
			},
			port: 8001,
			streaming: {
				enabled: false,
				// onShellReadyTimeout and onAllReadyTimeout not provided
			},
		};

		const validated = validateServerConfig(config);

		assertExists(validated.streaming);
		assertEquals(validated.streaming.enabled, false);
		assertEquals(validated.streaming.onShellReadyTimeout, 5000);
		assertEquals(validated.streaming.onAllReadyTimeout, 30000);
	});
});
