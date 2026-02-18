/**
 * Integration tests for streaming configuration
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import { validateServerConfig } from '../../schemas/server.ts';

describe('Streaming configuration integration', () => {
	it('should enable streaming by default', () => {
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

		expect(validated.streaming).toBeDefined();
		expect(validated.streaming.enabled).toEqual(true);
		expect(validated.streaming.onShellReadyTimeout).toEqual(5000);
		expect(validated.streaming.onAllReadyTimeout).toEqual(30000);
	});

	it('should allow disabling streaming for backward compatibility', () => {
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

		expect(validated.streaming).toBeDefined();
		expect(validated.streaming.enabled).toEqual(false);
	});

	it('should allow custom timeout values', () => {
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

		expect(validated.streaming).toBeDefined();
		expect(validated.streaming.enabled).toEqual(true);
		expect(validated.streaming.onShellReadyTimeout).toEqual(10000);
		expect(validated.streaming.onAllReadyTimeout).toEqual(60000);
	});

	it('should use defaults when streaming config is partially provided', () => {
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

		expect(validated.streaming).toBeDefined();
		expect(validated.streaming.enabled).toEqual(false);
		expect(validated.streaming.onShellReadyTimeout).toEqual(5000);
		expect(validated.streaming.onAllReadyTimeout).toEqual(30000);
	});
});
