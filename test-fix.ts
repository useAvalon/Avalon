import { createServer } from './src/render/server.ts';

const server = await createServer({
	routes: {
		'/': {
			component: () =>
				'<h1>Test - Check Console</h1><div data-hydrate="/test.js" data-condition="on:client">Loading...</div>',
		},
	},
	port: 8000,
});

console.log('Test server running on http://localhost:8000');
