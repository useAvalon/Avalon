import { createServer } from '@avalon/avalon';

const server = await createServer({
	routes: {}, // Empty routes - we'll use file-system routing
	port: 8002,
	defaultOptions: {
		title: 'Avalon Demo',
		description: 'Multi-framework SSR with islands architecture',
	},
	fileSystemRouting: {
		enabled: true,
		fallbackToManual: false,
		discovery: {
			pagesDirectory: 'src/pages',
			apiDirectory: 'src/api',
			layoutsDirectory: 'src/layouts',
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte', '.md', '.mdx'],
			enableWatching: true,
			developmentMode: true,
		},
	},
});

console.log('🚀 Avalon demo server starting on http://localhost:8002');
// Server is already listening - no need to call listen()
