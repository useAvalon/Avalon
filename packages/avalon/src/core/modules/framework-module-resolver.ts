/**
 * Framework-aware module resolver for handling framework-specific path transformations
 * and MIME type resolution during hydration and module serving.
 */

export interface ModuleResolutionConfig {
	framework: string;
	baseUrl: string;
	extensions: string[];
	transformPath: (path: string) => string;
	mimeType: string;
}

export interface ResolvedModule {
	originalPath: string;
	resolvedPath: string;
	framework: string;
	shouldTransform: boolean;
	mimeType: string;
	url: string;
}

export interface FrameworkModuleConfig {
	extensions: string[];
	hydrationExtension: string;
	mimeType: string;
	transformPath: (path: string, mode: 'development' | 'production') => string;
}

/**
 * Framework-specific module configurations
 */
const FRAMEWORK_MODULE_CONFIGS: Record<string, FrameworkModuleConfig> = {
	solid: {
		extensions: ['.tsx', '.jsx'],
		hydrationExtension: '.js',
		mimeType: 'application/javascript',
		transformPath: (path: string, mode: 'development' | 'production') => {
			// For Solid, transform .tsx to .js for hydration
			if (path.endsWith('.tsx')) {
				return path.replace(/\.tsx$/, '.js');
			}
			if (path.endsWith('.jsx')) {
				return path.replace(/\.jsx$/, '.js');
			}
			return path;
		},
	},
	preact: {
		extensions: ['.tsx', '.jsx'],
		hydrationExtension: '.js',
		mimeType: 'application/javascript',
		transformPath: (path: string, mode: 'development' | 'production') => {
			// For Preact, transform .tsx/.jsx to .js for hydration
			if (path.endsWith('.tsx')) {
				return path.replace(/\.tsx$/, '.js');
			}
			if (path.endsWith('.jsx')) {
				return path.replace(/\.jsx$/, '.js');
			}
			return path;
		},
	},
	vue: {
		extensions: ['.vue'],
		hydrationExtension: '.js',
		mimeType: 'application/javascript',
		transformPath: (path: string, mode: 'development' | 'production') => {
			// Vue components are typically compiled to .js
			if (path.endsWith('.vue')) {
				return path.replace(/\.vue$/, '.js');
			}
			return path;
		},
	},
	svelte: {
		extensions: ['.svelte'],
		hydrationExtension: '.js',
		mimeType: 'application/javascript',
		transformPath: (path: string, mode: 'development' | 'production') => {
			// Svelte components are compiled to .js
			if (path.endsWith('.svelte')) {
				return path.replace(/\.svelte$/, '.js');
			}
			return path;
		},
	},
	qwik: {
		extensions: ['.tsx', '.jsx'],
		hydrationExtension: '.js',
		mimeType: 'application/javascript',
		transformPath: (path: string, mode: 'development' | 'production') => {
			// Qwik components are compiled to .js via the Qwik optimizer
			if (path.endsWith('.tsx')) {
				return path.replace(/\.tsx$/, '.js');
			}
			if (path.endsWith('.jsx')) {
				return path.replace(/\.jsx$/, '.js');
			}
			return path;
		},
	},
};

export class FrameworkModuleResolver {
	private mode: 'development' | 'production';
	private baseUrl: string;

	constructor(mode: 'development' | 'production' = 'development', baseUrl = '') {
		this.mode = mode;
		this.baseUrl = baseUrl;
	}

	/**
	 * Resolve a module path for a specific framework
	 */
	resolveModule(
		originalPath: string,
		framework: string,
		options: {
			forHydration?: boolean;
			baseUrl?: string;
		} = {}
	): ResolvedModule {
		const config = FRAMEWORK_MODULE_CONFIGS[framework];
		if (!config) {
			throw new Error(`Unknown framework: ${framework}`);
		}

		const { forHydration = false, baseUrl = this.baseUrl } = options;

		let resolvedPath = originalPath;
		let shouldTransform = false;
		let mimeType = this.getMimeType(originalPath);

		// Apply framework-specific path transformation for hydration
		if (forHydration) {
			const transformedPath = config.transformPath(originalPath, this.mode);
			if (transformedPath !== originalPath) {
				resolvedPath = transformedPath;
				shouldTransform = true;
				mimeType = config.mimeType;
			}
		}

		// Generate the full URL
		const url = this.generateModuleUrl(resolvedPath, baseUrl);

		return {
			originalPath,
			resolvedPath,
			framework,
			shouldTransform,
			mimeType,
			url,
		};
	}

	/**
	 * Check if a path needs transformation for the given framework
	 */
	needsTransformation(path: string, framework: string): boolean {
		const config = FRAMEWORK_MODULE_CONFIGS[framework];
		if (!config) {
			return false;
		}

		const transformedPath = config.transformPath(path, this.mode);
		return transformedPath !== path;
	}

	/**
	 * Get the appropriate MIME type for a file path
	 */
	getMimeType(path: string): string {
		const ext = this.getFileExtension(path);

		switch (ext) {
			case '.js':
			case '.mjs':
				return 'application/javascript';
			case '.ts':
			case '.tsx':
			case '.jsx':
				return 'application/javascript'; // These are typically compiled to JS
			case '.css':
				return 'text/css';
			case '.json':
				return 'application/json';
			case '.vue':
			case '.svelte':
				return 'application/javascript'; // Compiled components
			default:
				return 'text/plain';
		}
	}

	/**
	 * Generate a module URL for the given path
	 */
	generateModuleUrl(path: string, baseUrl = this.baseUrl): string {
		// Ensure path starts with /
		const normalizedPath = path.startsWith('/') ? path : `/${path}`;

		if (baseUrl) {
			return `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
		}

		return normalizedPath;
	}

	/**
	 * Get supported frameworks
	 */
	getSupportedFrameworks(): string[] {
		return Object.keys(FRAMEWORK_MODULE_CONFIGS);
	}

	/**
	 * Get framework configuration
	 */
	getFrameworkConfig(framework: string): FrameworkModuleConfig | undefined {
		return FRAMEWORK_MODULE_CONFIGS[framework];
	}

	/**
	 * Check if a framework is supported
	 */
	isFrameworkSupported(framework: string): boolean {
		return framework in FRAMEWORK_MODULE_CONFIGS;
	}

	/**
	 * Get file extension from path
	 */
	private getFileExtension(path: string): string {
		const lastDot = path.lastIndexOf('.');
		return lastDot === -1 ? '' : path.substring(lastDot);
	}

	/**
	 * Set the resolver mode (development/production)
	 */
	setMode(mode: 'development' | 'production'): void {
		this.mode = mode;
	}

	/**
	 * Get current mode
	 */
	getMode(): 'development' | 'production' {
		return this.mode;
	}

	/**
	 * Set base URL for module resolution
	 */
	setBaseUrl(baseUrl: string): void {
		this.baseUrl = baseUrl;
	}

	/**
	 * Get current base URL
	 */
	getBaseUrl(): string {
		return this.baseUrl;
	}
}

/**
 * Default instance for common usage
 */
export const frameworkModuleResolver = new FrameworkModuleResolver();
