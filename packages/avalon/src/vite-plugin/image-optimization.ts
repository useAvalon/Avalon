/**
 * Image Optimization Plugin for Avalon
 *
 * Wraps vite-imagetools to provide automatic image optimization with
 * sensible defaults for responsive images, modern formats, and srcset generation.
 *
 * Features:
 * - Automatic WebP/AVIF conversion
 * - Responsive srcset generation at multiple breakpoints
 * - Metadata stripping for privacy
 * - JSX component output for easy usage in islands
 *
 * Usage in components:
 * ```tsx
 * // Basic - returns optimized URL
 * import heroImg from './hero.jpg?w=800&format=webp';
 *
 * // With srcset for responsive images
 * import heroImg from './hero.jpg?w=400;800;1200&format=webp&as=srcset';
 *
 * // As JSX component (like Qwik's ?jsx)
 * import HeroImage from './hero.jpg?w=1200&jsx';
 * <HeroImage alt="Hero" />
 * ```
 */

import type { Plugin } from 'vite';
import type { ResolvedImageConfig } from './types.ts';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * Creates the vite-imagetools plugin with Avalon's configuration
 */
export async function createImagePlugin(config: ResolvedImageConfig, verbose: boolean): Promise<Plugin[]> {
	if (!config.enabled) {
		if (verbose) {
			console.log('   ⏭️  Image optimization disabled');
		}
		return [];
	}

	try {
		// Dynamic import to avoid hard dependency if user disables images.
		// Use createRequire from the project root so we resolve the package
		// from the consuming project's node_modules, not avalon's own context.
		const require = createRequire(join(process.cwd(), 'package.json'));
		const { imagetools } = require('vite-imagetools');

		if (verbose) {
			console.log('   🖼️  Image optimization enabled');
			console.log(`      Format: ${config.defaultFormat}`);
			console.log(`      Quality: ${config.quality}`);
			console.log(`      Widths: ${config.widths.join(', ')}`);
		}

		const plugin = imagetools({
			include: config.include,
			exclude: config.exclude,
			removeMetadata: config.removeMetadata,

			// Default directives applied to all images unless overridden
			defaultDirectives: (url: URL) => {
				const params = new URLSearchParams();

				// Only apply defaults if no format specified
				if (!url.searchParams.has('format')) {
					params.set('format', config.defaultFormat);
				}

				// Only apply quality if not specified
				if (!url.searchParams.has('quality')) {
					params.set('quality', String(config.quality));
				}

				// If ?jsx is used, generate responsive srcset like Qwik
				if (url.searchParams.has('jsx')) {
					// Generate widths for srcset if not specified
					if (!url.searchParams.has('w') && !url.searchParams.has('width')) {
						params.set('w', config.widths.join(';'));
					}
					params.set('as', 'picture');
				}

				return params;
			},
		});

		return [plugin as Plugin];
	} catch (error) {
		// vite-imagetools not installed
		const message = error instanceof Error ? error.message : String(error);

		if (message.includes('Cannot find package') || message.includes('MODULE_NOT_FOUND')) {
			console.warn(
				'⚠️  Avalon: Image optimization is enabled but vite-imagetools is not installed.\n' +
					'   Install it with: bun add -d vite-imagetools\n' +
					'   Or disable image optimization: image: false',
			);
			return [];
		}

		throw error;
	}
}

/**
 * Type declarations for image imports
 * Users can reference these in their tsconfig.json
 */
export const IMAGE_TYPES_DECLARATION = `
declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.avif' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*?jsx' {
  import type { ComponentType } from 'preact';
  const Component: ComponentType<{ alt: string; class?: string; style?: Record<string, string> }>;
  export default Component;
}

declare module '*&jsx' {
  import type { ComponentType } from 'preact';
  const Component: ComponentType<{ alt: string; class?: string; style?: Record<string, string> }>;
  export default Component;
}
`;
