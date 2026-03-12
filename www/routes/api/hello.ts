/**
 * Hello API Route
 * GET /api/hello?name=World
 */

import { defineHandler } from 'nitro/h3';

export default defineHandler(event => {
	const name = event.url.searchParams.get('name') || 'World';

	return {
		message: `Hello, ${name}!`,
		timestamp: new Date().toISOString(),
		framework: 'Avalon',
		version: '1.0.0',
	};
});
