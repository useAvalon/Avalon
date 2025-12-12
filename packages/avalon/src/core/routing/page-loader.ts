import type { ComponentType } from 'preact';
import { join, extname } from '@std/path';
import { existsSync } from '@std/fs';
import {
	type RoutePageModule,
	RoutePageModuleSchema,
	isRoutePageModule,
	type MetadataGenerator,
	type PageLoader as PageLoaderFunction,
} from '../../schemas/routing.ts';
import { type LayoutConfig, LayoutConfigSchema } from '../../schemas/layout.ts';
import { type RoutingErrorHandler, createRoutingErrorHandler } from './error-handler.ts';
import type { ViteDevServer } from 'vite';

// Global Vite dev server declaration
declare global {
	var __viteDevServer: ViteDevServer | undefined;
}

/**
 * Error thrown when a page module fails to load or validate
 */
export class PageLoadError extends Error {
	public readonly filePath: string;
	public readonly originalError?: Error;

	constructor(message: string, filePath: string, originalError?: Error) {
		super(message);
		this.name = 'PageLoadError';
		this.filePath = filePath;
		this.originalError = originalError;
	}
}

/**
 * Error thrown when a page module has invalid exports
 */
export class PageValidationError extends Error {
	public readonly filePath: string;
	public readonly validationErrors: string[];

	constructor(message: string, filePath: string, validationErrors: string[]) {
		super(message);
		this.name = 'PageValidationError';
		this.filePath = filePath;
		this.validationErrors = validationErrors;
	}
}

/**
 * Options for PageLoader configuration
 */
export interface PageLoaderOptions {
	/** Base directory for pages (default: 'src/pages') */
	baseDirectory?: string;
	/** Supported file extensions (default: ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md']) */
	extensions?: string[];
	/** Enable development mode features */
	developmentMode?: boolean;
	/** Enable strict validation of page modules */
	strictValidation?: boolean;
	/** Quiet mode - suppress verbose logging */
	quietMode?: boolean;
}

/**
 * PageLoader handles dynamic loading and validation of page components
 * from the file system routing structure.
 */
export class PageLoader {
	private readonly baseDirectory: string;
	private readonly extensions: string[];
	private readonly developmentMode: boolean;
	private readonly strictValidation: boolean;
	private readonly quietMode: boolean;
	private readonly moduleCache = new Map<string, RoutePageModule>();
	private readonly errorHandler: RoutingErrorHandler;

	constructor(options: PageLoaderOptions = {}) {
		this.baseDirectory = options.baseDirectory ?? 'src/pages';
		this.extensions = options.extensions ?? ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md'];
		this.developmentMode = options.developmentMode ?? false;
		this.strictValidation = options.strictValidation ?? true;
		this.quietMode = options.quietMode ?? false;
		this.errorHandler = createRoutingErrorHandler({
			developmentMode: this.developmentMode,
			enableDebugLogging: this.developmentMode,
			enableDetailedErrors: true,
			enableSuggestions: true,
		});
	}

	/**
	 * Load a page module from the given file path using dynamic imports
	 * @param filePath - Absolute or relative path to the page file
	 * @returns Promise resolving to the loaded and validated page module
	 * @throws PageLoadError if the file cannot be loaded
	 * @throws PageValidationError if the module exports are invalid
	 */
	async loadPageModule(filePath: string): Promise<RoutePageModule> {
		// Check cache first (skip in development mode for hot reload)
		if (!this.developmentMode && this.moduleCache.has(filePath)) {
			const cached = this.moduleCache.get(filePath)!;
			return cached;
		}

		try {
			// Validate file exists
			if (!existsSync(filePath)) {
				const error = this.errorHandler.createInvalidFileStructureError(filePath, 'Page file not found');
				this.errorHandler.handleError(error);
				throw new PageLoadError(`Page file not found: ${filePath}`, filePath);
			}

			// Validate file extension
			const ext = extname(filePath);
			if (!this.extensions.includes(ext)) {
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					`Unsupported file extension: ${ext}. Supported extensions: ${this.extensions.join(', ')}`
				);
				this.errorHandler.handleError(error);
				throw new PageLoadError(
					`Unsupported file extension: ${ext}. Supported extensions: ${this.extensions.join(', ')}`,
					filePath
				);
			}

			if (this.developmentMode && !this.quietMode) {
				console.log(`📦 Loading page module: ${filePath}`);
			}

			let rawModule: Record<string, unknown>;

			// Check if this is an MDX file and we're in development mode
			const isMDXFile = filePath.endsWith('.mdx') || filePath.endsWith('.md');
			const isDev = Deno.env.get('DENO_ENV') !== 'production';

			if (isMDXFile && isDev) {
				// In development, use Vite's ssrLoadModule for MDX files
				const viteServer = (globalThis as typeof globalThis & { __viteDevServer?: ViteDevServer }).__viteDevServer;
				if (viteServer) {
					// Convert file path to Vite-compatible path
					const vitePath = filePath.startsWith('/') ? filePath : `/${filePath}`;
					rawModule = await viteServer.ssrLoadModule(vitePath);
				} else {
					// Fallback to direct import if Vite server not available
					const absolutePath = filePath.startsWith('/') ? filePath : join(Deno.cwd(), filePath);
					const moduleUrl = new URL(`file://${absolutePath}`).href;
					rawModule = await import(moduleUrl);
				}
			} else {
				// Dynamic import with proper URL handling for cross-platform compatibility
				const absolutePath = filePath.startsWith('/') ? filePath : join(Deno.cwd(), filePath);
				const moduleUrl = new URL(`file://${absolutePath}`).href;
				rawModule = await import(moduleUrl);
			}

			// Extract frontmatter from MDX modules and add it to the module
			if (isMDXFile && rawModule && typeof rawModule === 'object') {
				const moduleObj = rawModule as Record<string, unknown>;

				// Extract frontmatter fields that might be exported by remark-mdx-frontmatter
				const frontmatter: Record<string, unknown> = {};
				const frontmatterFields = ['title', 'description', 'layout', 'author', 'date', 'tags'];

				for (const field of frontmatterFields) {
					if (field in moduleObj && moduleObj[field] !== undefined) {
						frontmatter[field] = moduleObj[field];
					}
				}

				// Add frontmatter to the module if any was found
				if (Object.keys(frontmatter).length > 0) {
					moduleObj.frontmatter = frontmatter;
					if (this.developmentMode) {
						console.log(`📄 Extracted frontmatter from ${filePath}:`, frontmatter);
					}
				}
			}

			// Validate the loaded module
			const validatedModule = this.validatePageModule(rawModule, filePath);

			// Cache the validated module
			if (!this.developmentMode) {
				this.moduleCache.set(filePath, validatedModule);
			}

			if (this.developmentMode && !this.quietMode) {
				console.log(`✅ Successfully loaded page module: ${filePath}`);
			}

			return validatedModule;
		} catch (error) {
			if (error instanceof PageLoadError || error instanceof PageValidationError) {
				throw error;
			}

			// Create detailed syntax error for import/parsing issues
			const syntaxError = this.errorHandler.createSyntaxError(
				filePath,
				'page',
				error instanceof Error ? error : new Error(String(error))
			);
			this.errorHandler.handleError(syntaxError);

			// Wrap other errors in PageLoadError
			throw new PageLoadError(
				`Failed to load page module: ${error instanceof Error ? error.message : String(error)}`,
				filePath,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Validate that a loaded module conforms to the RoutePageModule interface
	 * @param module - Raw module object from dynamic import
	 * @param filePath - File path for error reporting
	 * @returns Validated RoutePageModule
	 * @throws PageValidationError if validation fails
	 */
	validatePageModule(module: unknown, filePath: string): RoutePageModule {
		const errors: string[] = [];

		// Check if module is an object
		if (!module || typeof module !== 'object') {
			const error = this.errorHandler.createInvalidFileStructureError(filePath, 'Page module must export an object');
			this.errorHandler.handleError(error);
			throw new PageValidationError('Page module must export an object', filePath, ['Module is not an object']);
		}

		const moduleObj = module as Record<string, unknown>;

		// Validate default export (required)
		if (!('default' in moduleObj)) {
			errors.push('Missing required default export (page component)');
			const error = this.errorHandler.createInvalidFileStructureError(
				filePath,
				'Missing required default export (page component)'
			);
			error.suggestions = [
				'Add a default export that returns a React/Preact component',
				'Example: export default function MyPage() { return <div>Hello</div>; }',
				'Or: const MyPage = () => <div>Hello</div>; export default MyPage;',
			];
			this.errorHandler.handleError(error);
		} else if (typeof moduleObj.default !== 'function') {
			errors.push('Default export must be a React/Preact component (function)');
			const error = this.errorHandler.createInvalidFileStructureError(
				filePath,
				'Default export must be a React/Preact component (function)'
			);
			error.suggestions = [
				'Ensure the default export is a function that returns JSX',
				'Components should be functions, not objects or primitives',
				'Example: export default function MyPage() { return <div>Content</div>; }',
			];
			this.errorHandler.handleError(error);
		}

		// Validate optional exports
		if ('layoutConfig' in moduleObj && moduleObj.layoutConfig !== undefined) {
			const layoutConfigValidation = LayoutConfigSchema.safeParse(moduleObj.layoutConfig);
			if (!layoutConfigValidation.success) {
				errors.push(`Invalid layoutConfig: ${layoutConfigValidation.error.message}`);
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					`Invalid layoutConfig: ${layoutConfigValidation.error.message}`
				);
				error.suggestions = [
					'Check the layoutConfig export matches the expected schema',
					'layoutConfig should be an object with valid layout configuration properties',
					'Remove layoutConfig export if not needed',
				];
				this.errorHandler.handleError(error);
			}
		}

		if ('generateMetadata' in moduleObj && moduleObj.generateMetadata !== undefined) {
			if (typeof moduleObj.generateMetadata !== 'function') {
				errors.push('generateMetadata must be a function');
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					'generateMetadata must be a function'
				);
				error.suggestions = [
					'generateMetadata should be a function that returns metadata',
					'Example: export const generateMetadata = (params) => ({ title: "Page Title" });',
					'Remove generateMetadata export if not needed',
				];
				this.errorHandler.handleError(error);
			}
		}

		if ('loader' in moduleObj && moduleObj.loader !== undefined) {
			if (typeof moduleObj.loader !== 'function') {
				errors.push('loader must be a function');
				const error = this.errorHandler.createInvalidFileStructureError(filePath, 'loader must be a function');
				error.suggestions = [
					'loader should be a function that returns data for the page',
					'Example: export const loader = (context) => ({ data: "some data" });',
					'Remove loader export if not needed',
				];
				this.errorHandler.handleError(error);
			}
		}

		// If strict validation is enabled, use Zod schema
		if (this.strictValidation) {
			const schemaValidation = RoutePageModuleSchema.safeParse(moduleObj);
			if (!schemaValidation.success) {
				errors.push(`Schema validation failed: ${schemaValidation.error.message}`);
				if (this.developmentMode) {
					const warning = this.errorHandler.createDevelopmentWarning(
						`Schema validation failed for ${filePath}: ${schemaValidation.error.message}`,
						filePath,
						['Check that all exports match the expected types and schemas']
					);
					this.errorHandler.handleError(warning);
				}
			}
		}

		// Throw validation error if any issues found
		if (errors.length > 0) {
			throw new PageValidationError(`Page module validation failed for ${filePath}`, filePath, errors);
		}

		// Return the validated module, only including defined properties
		const result: RoutePageModule = {
			default: moduleObj.default as ComponentType<Record<string, unknown>>,
		};

		if (moduleObj.layoutConfig !== undefined) {
			result.layoutConfig = moduleObj.layoutConfig as LayoutConfig;
		}

		if (moduleObj.generateMetadata !== undefined) {
			result.generateMetadata = moduleObj.generateMetadata as MetadataGenerator;
		}

		if (moduleObj.loader !== undefined) {
			result.loader = moduleObj.loader as PageLoaderFunction;
		}

		if (moduleObj.frontmatter !== undefined) {
			result.frontmatter = moduleObj.frontmatter as Record<string, unknown>;
		}

		return result;
	}

	/**
	 * Extract layout configuration from a page module
	 * @param module - Validated page module
	 * @returns Layout configuration or null if not present
	 */
	extractLayoutConfig(module: RoutePageModule) {
		if (!module.layoutConfig) {
			return null;
		}

		// Additional validation to ensure the config is properly structured
		try {
			const validated = LayoutConfigSchema.parse(module.layoutConfig);
			return validated;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(`Invalid layout config in page module:`, error);
			}
			return null;
		}
	}

	/**
	 * Check if a file path represents a valid page file
	 * @param filePath - File path to check
	 * @returns True if the file is a valid page file
	 */
	isValidPageFile(filePath: string) {
		// Check file extension first
		const ext = extname(filePath);
		if (!this.extensions.includes(ext)) {
			return false;
		}

		// Additional checks for special files that shouldn't be treated as pages
		const fileName = filePath.split('/').pop() || '';

		// Skip private files (starting with underscore) - these are handled separately
		if (fileName.startsWith('_')) {
			return false;
		}

		// Skip test files
		if (fileName.includes('.test.') || fileName.includes('.spec.')) {
			return false;
		}

		// Check if file exists (only after other validations to avoid permission issues in tests)
		if (!existsSync(filePath)) {
			return false;
		}

		return true;
	}

	/**
	 * Clear the module cache (useful for development/testing)
	 */
	clearCache() {
		this.moduleCache.clear();
	}

	/**
	 * Get cache statistics
	 * @returns Object with cache information
	 */
	getCacheStats() {
		return {
			size: this.moduleCache.size,
			keys: Array.from(this.moduleCache.keys()),
		};
	}

	/**
	 * Preload a page module (useful for performance optimization)
	 * @param filePath - Path to the page file to preload
	 * @returns Promise that resolves when the module is loaded and cached
	 */
	async preloadPageModule(filePath: string) {
		try {
			await this.loadPageModule(filePath);
		} catch (error) {
			if (this.developmentMode) {
				console.warn(`Failed to preload page module ${filePath}:`, error);
			}
			// Don't throw - preloading is optional
		}
	}

	/**
	 * Get the error handler instance for external access
	 */
	getErrorHandler(): RoutingErrorHandler {
		return this.errorHandler;
	}

	/**
	 * Get configuration options
	 * @returns Current PageLoader configuration
	 */
	getOptions(): Required<PageLoaderOptions> {
		return {
			baseDirectory: this.baseDirectory,
			extensions: this.extensions,
			developmentMode: this.developmentMode,
			strictValidation: this.strictValidation,
			quietMode: this.quietMode,
		};
	}

	/**
	 * Load a special file (_404.tsx or _error.tsx)
	 * @param fileType - Type of special file to load
	 * @param routePath - Route path context for the special file
	 * @returns Promise resolving to the loaded special file module and path, or null if not found
	 */
	async loadSpecialFile(
		fileType: 'error' | '404',
		_routePath: string
	): Promise<{ module: RoutePageModule; filePath: string } | null> {
		const fileName = fileType === '404' ? '_404' : '_error';
		
		// Try to find the special file in the pages directory
		for (const ext of this.extensions) {
			const filePath = join(this.baseDirectory, `${fileName}${ext}`);
			
			if (existsSync(filePath)) {
				try {
					const module = await this.loadPageModule(filePath);
					return { module, filePath };
				} catch (error) {
					if (this.developmentMode) {
						console.warn(`Failed to load special file ${filePath}:`, error);
					}
				}
			}
		}
		
		return null;
	}

	/**
	 * Get a fallback special file when no custom file is found
	 * @param fileType - Type of special file
	 * @returns Fallback module and path
	 */
	getFallbackSpecialFile(fileType: 'error' | '404'): { module: RoutePageModule; filePath: string } {
		// Create a basic fallback component
		const fallbackComponent = (_props: Record<string, unknown>) => {
			const heading = fileType === '404' ? 'Page Not Found' : 'Something went wrong';
			const message =
				fileType === '404'
					? "The page you're looking for doesn't exist or has been moved."
					: 'An error occurred while processing your request.';

			return {
				type: 'div',
				props: {
					style: {
						fontFamily: 'system-ui, -apple-system, sans-serif',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						minHeight: '100vh',
						margin: 0,
						padding: '2rem',
						textAlign: 'center',
						background: '#f9f9f9',
					},
					children: [
						{
							type: 'div',
							props: {
								style: {
									maxWidth: '600px',
									background: 'white',
									padding: '2rem',
									borderRadius: '8px',
									boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
								},
								children: [
									{
										type: 'h1',
										props: {
											style: {
												fontSize: '3rem',
												margin: 0,
												color: fileType === '404' ? '#666' : '#d32f2f',
											},
											children: fileType === '404' ? '404' : '⚠️',
										},
									},
									{
										type: 'h2',
										props: {
											style: { fontSize: '1.5rem', margin: '1rem 0', color: '#888' },
											children: heading,
										},
									},
									{
										type: 'p',
										props: {
											style: { color: '#666', lineHeight: 1.5 },
											children: message,
										},
									},
								],
							},
						},
					],
				},
			};
		};

		const module: RoutePageModule = {
			default: fallbackComponent as ComponentType<Record<string, unknown>>,
		};

		return {
			module,
			filePath: `internal:fallback-${fileType}`,
		};
	}
}

/**
 * Default PageLoader instance for convenience
 */
export const defaultPageLoader = new PageLoader();

/**
 * Create a new PageLoader with custom options
 * @param options - Configuration options
 * @returns New PageLoader instance
 */
export function createPageLoader(options: PageLoaderOptions = {}): PageLoader {
	return new PageLoader(options);
}

/**
 * Type guard to check if an object is a valid RoutePageModule
 * @param obj - Object to check
 * @returns True if the object is a valid RoutePageModule
 */
export function isValidPageModule(obj: unknown): obj is RoutePageModule {
	return isRoutePageModule(obj);
}

/**
 * Utility function to extract component name from a page module for debugging
 * @param module - Page module
 * @returns Component name or 'Anonymous' if not available
 */
export function getPageComponentName(module: RoutePageModule) {
	const component = module.default;
	return component.displayName || component.name || 'Anonymous';
}
