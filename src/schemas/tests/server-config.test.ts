/**
 * Tests for server configuration with file-system routing
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { validateServerConfig, safeValidateServerConfig } from '../server.ts';

Deno.test('Server configuration with file-system routing', async t => {
	await t.step('should validate config with file-system routing enabled', () => {
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
		assertExists(result);
		assertEquals(result.fileSystemRouting?.enabled, true);
		assertEquals(result.fileSystemRouting?.discovery?.pagesDirectory, 'src/pages');
	});

	await t.step('should validate config without file-system routing', () => {
		const config = {
			routes: {},
			port: 8001,
		};

		const result = validateServerConfig(config);
		assertExists(result);
		assertEquals(result.fileSystemRouting, undefined);
	});

	await t.step('should validate config with partial file-system routing config', () => {
		const config = {
			routes: {},
			port: 8001,
			fileSystemRouting: {
				enabled: true,
			},
		};

		const result = validateServerConfig(config);
		assertExists(result);
		assertEquals(result.fileSystemRouting?.enabled, true);
	});

	await t.step('should handle invalid file-system routing config gracefully', () => {
		const config = {
			routes: {},
			port: 8001,
			fileSystemRouting: {
				enabled: 'invalid', // Should be boolean
			},
		};

		const result = safeValidateServerConfig(config);
		assertEquals(result.success, false);
	});
});
