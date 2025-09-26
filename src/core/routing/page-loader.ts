import { ComponentType } from 'preact';
import { join, extname } from '@std/path';
import { existsSync } from '@std/fs';
import {
	RoutePageModule,
	RoutePageModuleSchema,
	isRoutePageModule,
	PageComponent,
	MetadataGenerator,
	PageLoader as PageLoaderFunction,
	PageProps,
} from '../../schemas/routing.ts';
import { LayoutConfig, LayoutConfigSchema } from '../../schemas/layout.ts';
import { RoutingErrorHandler, RoutingErrorCode, ErrorSeverity, createRoutingErrorHandler } from './error-handler.ts';
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
	private readonly moduleCache = new Map<string, RoutePageModule>();
	private readonly errorHandler: RoutingErrorHandler;

	constructor(options: PageLoaderOptions = {}) {
		this.baseDirectory = options.baseDirectory ?? 'src/pages';
		this.extensions = options.extensions ?? ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md'];
		this.developmentMode = options.developmentMode ?? false;
		this.strictValidation = options.strictValidation ?? true;
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

			if (this.developmentMode) {
				console.log(`📦 Loading page module: ${filePath}`);
			}

			let rawModule: any;

			// Check if this is an MDX file and we're in development mode
			const isMDXFile = filePath.endsWith('.mdx') || filePath.endsWith('.md');
			const isDev = Deno.env.get('DENO_ENV') !== 'production';

			if (isMDXFile && isDev) {
				// In development, use Vite's ssrLoadModule for MDX files
				const viteServer = (globalThis as any).__viteDevServer;
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
					(moduleObj as any).frontmatter = frontmatter;
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

			if (this.developmentMode) {
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
			default: moduleObj.default as ComponentType<any>,
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
			result.frontmatter = moduleObj.frontmatter as Record<string, any>;
		}

		return result;
	}

	/**
	 * Extract layout configuration from a page module
	 * @param module - Validated page module
	 * @returns Layout configuration or null if not present
	 */
	extractLayoutConfig(module: RoutePageModule): LayoutConfig | null {
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
	isValidPageFile(filePath: string): boolean {
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
	clearCache(): void {
		this.moduleCache.clear();
	}

	/**
	 * Get cache statistics
	 * @returns Object with cache information
	 */
	getCacheStats(): { size: number; keys: string[] } {
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
	async preloadPageModule(filePath: string): Promise<void> {
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
export function getPageComponentName(module: RoutePageModule): string {
	const component = module.default;
	return component.displayName || component.name || 'Anonymous';
}
