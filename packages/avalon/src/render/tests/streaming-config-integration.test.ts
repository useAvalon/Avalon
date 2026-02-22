/**
 * Integration tests for streaming configuration
 *
 * Validates: Requirements 9.1
 */

import { describe, it, expect } from 'vitest';
import { StreamingConfigSchema } from '../../schemas/server.ts';

describe('Streaming configuration integration', () => {
	it('should enable streaming by default', () => {
		const config = {
			port: 8001,
		};

		const validated = StreamingConfigSchema.parse(config.streaming ?? undefined);

		expect(validated).toBeDefined();
		expect(validated.enabled).toEqual(true);
		expect(validated.onShellReadyTimeout).toEqual(5000);
		expect(validated.onAllReadyTimeout).toEqual(30000);
	});

	it('should allow disabling streaming for backward compatibility', () => {
		const config = {
			port: 8001,
			streaming: {
				enabled: false,
			},
		};

		const validated = StreamingConfigSchema.parse(config.streaming ?? undefined);

		expect(validated).toBeDefined();
		expect(validated.enabled).toEqual(false);
	});

	it('should allow custom timeout values', () => {
		const config = {
			port: 8001,
			streaming: {
				enabled: true,
				onShellReadyTimeout: 10000,
				onAllReadyTimeout: 60000,
			},
		};

		const validated = StreamingConfigSchema.parse(config.streaming ?? undefined);

		expect(validated).toBeDefined();
		expect(validated.enabled).toEqual(true);
		expect(validated.onShellReadyTimeout).toEqual(10000);
		expect(validated.onAllReadyTimeout).toEqual(60000);
	});

	it('should use defaults when streaming config is partially provided', () => {
		const config = {
			port: 8001,
			streaming: {
				enabled: false,
			},
		};

		const validated = StreamingConfigSchema.parse(config.streaming ?? undefined);

		expect(validated).toBeDefined();
		expect(validated.enabled).toEqual(false);
		expect(validated.onShellReadyTimeout).toEqual(5000);
		expect(validated.onAllReadyTimeout).toEqual(30000);
	});
});
