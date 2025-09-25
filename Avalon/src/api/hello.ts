import type { ApiHandler } from '@avalon/avalon';

export const GET: ApiHandler = async req => {
	const url = new URL(req.url);
	const name = url.searchParams.get('name') || 'World';

	return Response.json({
		message: `Hello, ${name}!`,
		timestamp: new Date().toISOString(),
		framework: 'Avalon',
		version: '1.0.0',
	});
};
