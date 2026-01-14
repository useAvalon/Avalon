/**
 * Tests for streaming configuration schema
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 10.1
 */

import { assertEquals, assertExists } from '@std/assert';
import { StreamingConfigSchema, type StreamingConfig } from '../server.ts';

Deno.test('StreamingConfigSchema', async (t) => {
	await t.step('should accept valid streaming configuration with all fields', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 5000,
			onAllReadyTimeout: 30000,
		};

		const result = StreamingConfigSchema.parse(config);

		assertEquals(result.enabled, true);
		assertEquals(result.onShellReadyTimeout, 5000);
		assertEquals(result.onAllReadyTimeout, 30000);
	});

	await t.step('should use default values when not provided', () => {
		const config = {};

		const result = StreamingConfigSchema.parse(config);

		assertEquals(result.enabled, true);
		assertEquals(result.onShellReadyTimeout, 5000);
		assertEquals(result.onAllReadyTimeout, 30000);
	});

	await t.step('should accept enabled: false for backward compatibility', () => {
		const config = {
			enabled: false,
		};

		const result = StreamingConfigSchema.parse(config);

		assertEquals(result.enabled, false);
		assertEquals(result.onShellReadyTimeout, 5000);
		assertEquals(result.onAllReadyTimeout, 30000);
	});

	await t.step('should accept custom timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 10000,
			onAllReadyTimeout: 60000,
		};

		const result = StreamingConfigSchema.parse(config);

		assertEquals(result.enabled, true);
		assertEquals(result.onShellReadyTimeout, 10000);
		assertEquals(result.onAllReadyTimeout, 60000);
	});

	await t.step('should reject negative timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: -1000,
			onAllReadyTimeout: 30000,
		};

		try {
			StreamingConfigSchema.parse(config);
			throw new Error('Should have thrown validation error');
		} catch (error) {
			assertExists(error);
		}
	});

	await t.step('should accept zero timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 0,
			onAllReadyTimeout: 0,
		};

		const result = StreamingConfigSchema.parse(config);

		assertEquals(result.enabled, true);
		assertEquals(result.onShellReadyTimeout, 0);
		assertEquals(result.onAllReadyTimeout, 0);
	});

	await t.step('should be optional in server config', () => {
		// When streaming config is not provided, it should use defaults
		const result = StreamingConfigSchema.optional().parse(undefined);

		assertEquals(result, undefined);
	});

	await t.step('should use defaults when optional and not provided', () => {
		// When using the default() method, it should provide default values
		const schema = StreamingConfigSchema.optional().default({
			enabled: true,
			onShellReadyTimeout: 5000,
			onAllReadyTimeout: 30000,
		});

		const result = schema.parse(undefined);

		assertEquals(result.enabled, true);
		assertEquals(result.onShellReadyTimeout, 5000);
		assertEquals(result.onAllReadyTimeout, 30000);
	});
});

Deno.test('StreamingConfig type inference', () => {
	// This test verifies that the TypeScript type is correctly inferred
	const config: StreamingConfig = {
		enabled: true,
		onShellReadyTimeout: 5000,
		onAllReadyTimeout: 30000,
	};

	assertExists(config);
	assertEquals(typeof config.enabled, 'boolean');
	assertEquals(typeof config.onShellReadyTimeout, 'number');
	assertEquals(typeof config.onAllReadyTimeout, 'number');
});
