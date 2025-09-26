import { defineConfig } from 'https://esm.sh/vite@5.0.0';
import { resolve } from '@std/path';

export default defineConfig({
	root: '.',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(import.meta.dirname || '.', 'index.html'),
			},
		},
	},
	server: {
		port: 3001,
		host: true,
	},
	resolve: {
		alias: {
			'@': resolve(import.meta.dirname || '.', 'src'),
			'@docs': resolve(import.meta.dirname || '.', '.'),
		},
	},
	optimizeDeps: {
		include: ['preact', 'vue', 'svelte', 'solid-js'],
	},
	plugins: [
		// Custom plugin for processing markdown files
		{
			name: 'markdown-processor',
			configureServer(server) {
				server.middlewares.use('/docs', (req, res, next) => {
					if (req.url?.endsWith('.md')) {
						// Process markdown files with code examples
						// This will be expanded to handle syntax highlighting and validation
						res.setHeader('Content-Type', 'text/html');
					}
					next();
				});
			},
		},
	],
});
