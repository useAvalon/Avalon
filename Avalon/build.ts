import { build } from '@avalon/avalon';

await build({
	pagesDir: './src/pages',
	layoutsDir: './src/layouts',
	apiDir: './src/api',
	staticDir: './public',
	outDir: './dist',
	viteConfig: './vite.config.ts',
});

console.log('✅ Build complete!');
