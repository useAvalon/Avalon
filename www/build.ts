import { build } from '@useavalon/avalon';

await build({
	pagesDir: './src/pages',
	layoutsDir: './src/layouts',
	staticDir: './public',
	outDir: './dist',
	viteConfig: './vite.config.ts',
});

console.log('✅ Build complete!');
