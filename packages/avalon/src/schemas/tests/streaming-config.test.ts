/**
 * Tests for streaming configuration schema
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 10.1
 */

import { describe, it, expect } from 'vitest';
import { StreamingConfigSchema, type StreamingConfig } from '../server.ts';

describe('StreamingConfigSchema', () => {
	it('should accept valid streaming configuration with all fields', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 5000,
			onAllReadyTimeout: 30000,
		};

		const result = StreamingConfigSchema.parse(config);

		expect(result.enabled).toEqual(true);
		expect(result.onShellReadyTimeout).toEqual(5000);
		expect(result.onAllReadyTimeout).toEqual(30000);
	});

	it('should use default values when not provided', () => {
		const config = {};

		const result = StreamingConfigSchema.parse(config);

		expect(result.enabled).toEqual(true);
		expect(result.onShellReadyTimeout).toEqual(5000);
		expect(result.onAllReadyTimeout).toEqual(30000);
	});

	it('should accept enabled: false for backward compatibility', () => {
		const config = {
			enabled: false,
		};

		const result = StreamingConfigSchema.parse(config);

		expect(result.enabled).toEqual(false);
		expect(result.onShellReadyTimeout).toEqual(5000);
		expect(result.onAllReadyTimeout).toEqual(30000);
	});

	it('should accept custom timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 10000,
			onAllReadyTimeout: 60000,
		};

		const result = StreamingConfigSchema.parse(config);

		expect(result.enabled).toEqual(true);
		expect(result.onShellReadyTimeout).toEqual(10000);
		expect(result.onAllReadyTimeout).toEqual(60000);
	});

	it('should reject negative timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: -1000,
			onAllReadyTimeout: 30000,
		};

		expect(() => StreamingConfigSchema.parse(config)).toThrow();
	});

	it('should accept zero timeout values', () => {
		const config = {
			enabled: true,
			onShellReadyTimeout: 0,
			onAllReadyTimeout: 0,
		};

		const result = StreamingConfigSchema.parse(config);

		expect(result.enabled).toEqual(true);
		expect(result.onShellReadyTimeout).toEqual(0);
		expect(result.onAllReadyTimeout).toEqual(0);
	});

	it('should be optional in server config', () => {
		const result = StreamingConfigSchema.optional().parse(undefined);

		expect(result).toEqual(undefined);
	});

	it('should use defaults when optional and not provided', () => {
		const schema = StreamingConfigSchema.optional().default({
			enabled: true,
			onShellReadyTimeout: 5000,
			onAllReadyTimeout: 30000,
		});

		const result = schema.parse(undefined);

		expect(result.enabled).toEqual(true);
		expect(result.onShellReadyTimeout).toEqual(5000);
		expect(result.onAllReadyTimeout).toEqual(30000);
	});
});

describe('StreamingConfig type inference', () => {
	it('should have correct types', () => {
		const config: StreamingConfig = {
			enabled: true,
			onShellReadyTimeout: 5000,
			onAllReadyTimeout: 30000,
		};

		expect(config).toBeDefined();
		expect(typeof config.enabled).toEqual('boolean');
		expect(typeof config.onShellReadyTimeout).toEqual('number');
		expect(typeof config.onAllReadyTimeout).toEqual('number');
	});
});
