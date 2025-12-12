/**
 * Routes for serving framework-specific modules during hydration
 */

import { FrameworkModuleResolver } from '../../core/modules/framework-module-resolver.ts';
import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';

export interface HydrationRequest {
	path: string;
	framework: string;
	originalExtension: string;
	targetExtension: string;
}

export interface HydrationResponse {
	content: string;
	mimeType: string;
	headers: Record<string, string>;
}

export class HydrationRouteHandler {
	private moduleResolver: FrameworkModuleResolver;
	private isDev: boolean;

	constructor(isDev: boolean = false) {
		this.isDev = isDev;
		this.moduleResolver = new FrameworkModuleResolver(isDev ? 'development' : 'production');
	}

	/**
	 * Handle hydration module requests
	 */
	async handleHydrationRequest(
		req: Request,
		_middlewareContext?: MiddlewareContext,
		_layoutContext?: LayoutContext
	): Promise<Response> {
		try {
			const url = new URL(req.url);
			const pathname = url.pathname;

			// Extract framework from query parameter or path
			const framework = url.searchParams.get('framework') || this.detectFrameworkFromPath(pathname);

			if (!framework) {
				return new Response('Framework not specified', { status: 400 });
			}

			if (!this.moduleResolver.isFrameworkSupported(framework)) {
				return new Response(`Unsupported framework: ${framework}`, { status: 400 });
			}

			// Resolve the module using the framework resolver
			const resolvedModule = this.moduleResolver.resolveModule(pathname, framework, {
				forHydration: true,
			});

			// Try to load the module content
			const content = await this.loadModuleContent(resolvedModule.originalPath, resolvedModule.resolvedPath);

			if (!content) {
				return new Response(`Module not found: ${pathname}`, { status: 404 });
			}

			// Return the module with proper headers
			return new Response(content, {
				headers: {
					'Content-Type': `${resolvedModule.mimeType}; charset=utf-8`,
					'Cache-Control': this.isDev ? 'no-cache' : 'public, max-age=86400',
					'X-Framework': framework,
					'X-Original-Path': resolvedModule.originalPath,
					'X-Resolved-Path': resolvedModule.resolvedPath,
				},
			});
		} catch (error) {
			console.error('Error handling hydration request:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	}

	/**
	 * Load module content from file system
	 */
	private async loadModuleContent(originalPath: string, resolvedPath: string) {
		// Try multiple possible locations for the module
		const possiblePaths = [
			resolvedPath,
			originalPath,
			// Try in islands directory
			`src/islands/${resolvedPath.split('/').pop()}`,
			`src/islands/${originalPath.split('/').pop()}`,
			// Try in components directory
			`src/components/${resolvedPath.split('/').pop()}`,
			`src/components/${originalPath.split('/').pop()}`,
		];

		for (const path of possiblePaths) {
			try {
				// Remove leading slash for file system access
				const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
				const content = await Deno.readTextFile(normalizedPath);
				return content;
			} catch {
				// Continue to next path
				continue;
			}
		}

		return null;
	}

	/**
	 * Detect framework from file path patterns
	 */
	private detectFrameworkFromPath(pathname: string) {
		// Check for framework-specific patterns in the path
		if (pathname.includes('/solid/') || pathname.includes('solid-')) {
			return 'solid';
		}
		if (pathname.includes('/preact/') || pathname.includes('preact-')) {
			return 'preact';
		}
		if (pathname.includes('/vue/') || pathname.endsWith('.vue')) {
			return 'vue';
		}
		if (pathname.includes('/svelte/') || pathname.endsWith('.svelte')) {
			return 'svelte';
		}

		// Default to solid for .tsx files (since this is the main issue we're solving)
		if (pathname.endsWith('.tsx')) {
			return 'solid';
		}

		return null;
	}

	/**
	 * Check if a request is for hydration modules
	 */
	static isHydrationRequest(pathname: string) {
		// Check for common hydration patterns
		return (
			pathname.includes('/islands/') ||
			pathname.includes('/components/') ||
			pathname.endsWith('.tsx') ||
			pathname.endsWith('.jsx') ||
			pathname.endsWith('.vue') ||
			pathname.endsWith('.svelte')
		);
	}
}

/**
 * Create hydration routes for framework-specific module serving
 */
export function createHydrationRoutes(isDev: boolean) {
	// In development mode, let Vite handle all module compilation and serving
	// We only need hydration routes in production or for specific non-Vite scenarios
	if (isDev) {
		return [];
	}

	const handler = new HydrationRouteHandler(isDev);

	return [
		// Production-only hydration routes
		// In production, we might need to serve pre-compiled modules
		{
			pattern: new URLPattern({ pathname: '/islands/*' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
				return await handler.handleHydrationRequest(req, middlewareContext, layoutContext);
			},
		},
	];
}
