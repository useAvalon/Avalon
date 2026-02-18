/**
 * Tests for server configuration with file-system routing
 */

import { describe, it, expect } from 'vitest';
import { validateServerConfig, safeValidateServerConfig } from '../server.ts';

describe('Server configuration with file-system routing', () => {
	it('should validate config with file-system routing enabled', () => {
		const config = {
			routes: {},
			port: 8001,
			fileSystemRouting: {
				enabled: true,
				fallbackToManual: true,
				enableCaching: true,
				discovery: {
					pagesDirectory: 'src/pages',
					apiDirectory: 'src/api',
					extensions: ['.tsx', '.ts'],
					excludeDirectories: ['node_modules'],
					enableWatching: false,
					developmentMode: false,
				},
			},
		};

		const result = validateServerConfig(config);
		expect(result).toBeDefined();
		expect(result.fileSystemRouting?.enabled).toEqual(true);
		expect(result.fileSystemRouting?.discovery?.pagesDirectory).toEqual('src/pages');
	});

	it('should validate config without file-system routing', () => {
		const config = {
			routes: {},
			port: 8001,
		};

		const result = validateServerConfig(config);
		expect(result).toBeDefined();
		expect(result.fileSystemRouting).toEqual(undefined);
	});

	it('should validate config with partial file-system routing config', () => {
		const config = {
			routes: {},
			port: 8001,
			fileSystemRouting: {
				enabled: true,
			},
		};

		const result = validateServerConfig(config);
		expect(result).toBeDefined();
		expect(result.fileSystemRouting?.enabled).toEqual(true);
	});

	it('should handle invalid file-system routing config gracefully', () => {
		const config = {
			routes: {},
			port: 8001,
			fileSystemRouting: {
				enabled: 'invalid', // Should be boolean
			},
		};

		const result = safeValidateServerConfig(config);
		expect(result.success).toEqual(false);
	});
});
