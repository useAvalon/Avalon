import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { LayoutConfig, LayoutHandler, LayoutContext } from '../../types/layout.ts';

// Validation schemas
export const LayoutConfigSchema = z
	.object({
		skipLayouts: z.array(z.string()).optional(),
		replaceLayout: z.boolean().optional(),
		onlyLayouts: z.array(z.string()).optional(),
		customLayout: z.string().optional(),
	})
	.strict();

export const LayoutHandlerSchema = z.object({
	component: z.any(), // ComponentType - can't validate at runtime
	loader: z.function().optional(),
	path: z.string(),
	priority: z.number(),
});

export const LayoutContextSchema = z.object({
	request: z.any(), // Request object
	params: z.record(z.string()),
	query: z.any(), // URLSearchParams
	state: z.any(), // Map<string, unknown>
	middlewareContext: z.any().optional(),
});

// Validation error types
export interface ValidationError {
	field: string;
	message: string;
	value?: any;
	code: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationWarning {
	field: string;
	message: string;
	value?: any;
	severity: 'low' | 'medium' | 'high';
}

export interface ConfigValidationOptions {
	strict: boolean;
	allowUnknownFields: boolean;
	validatePaths: boolean;
	checkFileExists: boolean;
}

export class LayoutConfigValidator {
	constructor(private options: ConfigValidationOptions) {}

	// Layout configuration validation
	validateLayoutConfig(config: any): ValidationResult {
		const result: ValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
		};

		try {
			// Basic schema validation
			const parsed = LayoutConfigSchema.parse(config);

			// Additional validation rules
			this.validateConfigLogic(parsed, result);
			this.validateConfigPaths(parsed, result);
		} catch (error) {
			if (error instanceof z.ZodError) {
				result.valid = false;
				result.errors = error.errors.map(err => ({
					field: err.path.join('.'),
					message: err.message,
					value: (err as any).received || undefined,
					code: err.code,
				}));
			} else {
				result.valid = false;
				result.errors.push({
					field: 'config',
					message: `Validation failed: ${(error as Error).message}`,
					code: 'VALIDATION_ERROR',
				});
			}
		}

		return result;
	}

	// Layout handler validation
	validateLayoutHandler(handler: any): ValidationResult {
		const result: ValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
		};

		try {
			LayoutHandlerSchema.parse(handler);

			// Additional validation
			this.validateHandlerLogic(handler, result);
		} catch (error) {
			if (error instanceof z.ZodError) {
				result.valid = false;
				result.errors = error.errors.map(err => ({
					field: err.path.join('.'),
					message: err.message,
					value: (err as any).received || undefined,
					code: err.code,
				}));
			} else {
				result.valid = false;
				result.errors.push({
					field: 'handler',
					message: `Handler validation failed: ${(error as Error).message}`,
					code: 'HANDLER_VALIDATION_ERROR',
				});
			}
		}

		return result;
	}

	// Layout context validation
	validateLayoutContext(context: any): ValidationResult {
		const result: ValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
		};

		try {
			LayoutContextSchema.parse(context);

			// Additional context validation
			this.validateContextLogic(context, result);
		} catch (error) {
			if (error instanceof z.ZodError) {
				result.valid = false;
				result.errors = error.errors.map(err => ({
					field: err.path.join('.'),
					message: err.message,
					value: (err as any).received || undefined,
					code: err.code,
				}));
			} else {
				result.valid = false;
				result.errors.push({
					field: 'context',
					message: `Context validation failed: ${(error as Error).message}`,
					code: 'CONTEXT_VALIDATION_ERROR',
				});
			}
		}

		return result;
	}

	// Layout chain validation
	validateLayoutChain(handlers: LayoutHandler[]): ValidationResult {
		const result: ValidationResult = {
			valid: true,
			errors: [],
			warnings: [],
		};

		// Check for empty chain
		if (handlers.length === 0) {
			result.warnings.push({
				field: 'handlers',
				message: 'Layout chain is empty',
				severity: 'medium',
			});
			return result;
		}

		// Validate each handler
		for (let i = 0; i < handlers.length; i++) {
			const handlerResult = this.validateLayoutHandler(handlers[i]);
			if (!handlerResult.valid) {
				result.valid = false;
				result.errors.push(
					...handlerResult.errors.map(err => ({
						...err,
						field: `handlers[${i}].${err.field}`,
					}))
				);
			}
			result.warnings.push(
				...handlerResult.warnings.map(warn => ({
					...warn,
					field: `handlers[${i}].${warn.field}`,
				}))
			);
		}

		// Validate chain logic
		this.validateChainLogic(handlers, result);

		return result;
	}

	// Private validation methods
	private validateConfigLogic(config: LayoutConfig, result: ValidationResult): void {
		// Check for conflicting options
		if (config.replaceLayout && config.skipLayouts && config.skipLayouts.length > 0) {
			result.warnings.push({
				field: 'replaceLayout',
				message: 'replaceLayout is true but skipLayouts is also specified. replaceLayout will take precedence.',
				severity: 'medium',
			});
		}

		if (config.replaceLayout && config.onlyLayouts && config.onlyLayouts.length > 0) {
			result.warnings.push({
				field: 'replaceLayout',
				message: 'replaceLayout is true but onlyLayouts is also specified. replaceLayout will take precedence.',
				severity: 'medium',
			});
		}

		if (config.skipLayouts && config.onlyLayouts) {
			const intersection = config.skipLayouts.filter(layout => config.onlyLayouts!.includes(layout));
			if (intersection.length > 0) {
				result.errors.push({
					field: 'skipLayouts',
					message: `Layouts cannot be both skipped and included: ${intersection.join(', ')}`,
					code: 'CONFLICTING_CONFIG',
				});
				result.valid = false;
			}
		}

		// Check for empty arrays
		if (config.skipLayouts && config.skipLayouts.length === 0) {
			result.warnings.push({
				field: 'skipLayouts',
				message: 'skipLayouts is an empty array, consider removing it',
				severity: 'low',
			});
		}

		if (config.onlyLayouts && config.onlyLayouts.length === 0) {
			result.warnings.push({
				field: 'onlyLayouts',
				message: 'onlyLayouts is an empty array, consider removing it',
				severity: 'low',
			});
		}
	}

	private validateConfigPaths(config: LayoutConfig, result: ValidationResult): void {
		if (!this.options.validatePaths) return;

		// Validate custom layout path
		if (config.customLayout) {
			if (!config.customLayout.endsWith('.tsx') && !config.customLayout.endsWith('.jsx')) {
				result.warnings.push({
					field: 'customLayout',
					message: 'Custom layout path should end with .tsx or .jsx',
					value: config.customLayout,
					severity: 'medium',
				});
			}

			if (this.options.checkFileExists) {
				try {
					const stat = Deno.statSync(config.customLayout);
					if (!stat.isFile) {
						result.errors.push({
							field: 'customLayout',
							message: 'Custom layout path does not point to a file',
							value: config.customLayout,
							code: 'FILE_NOT_FOUND',
						});
						result.valid = false;
					}
				} catch {
					result.errors.push({
						field: 'customLayout',
						message: 'Custom layout file does not exist',
						value: config.customLayout,
						code: 'FILE_NOT_FOUND',
					});
					result.valid = false;
				}
			}
		}

		// Validate skip/only layout paths
		const pathArrays = [
			{ field: 'skipLayouts', paths: config.skipLayouts },
			{ field: 'onlyLayouts', paths: config.onlyLayouts },
		];

		for (const { field, paths } of pathArrays) {
			if (!paths) continue;

			for (let i = 0; i < paths.length; i++) {
				const path = paths[i];

				// Check path format
				if (!path.includes('_layout')) {
					result.warnings.push({
						field: `${field}[${i}]`,
						message: 'Layout path should contain "_layout"',
						value: path,
						severity: 'medium',
					});
				}

				// Check file existence if enabled
				if (this.options.checkFileExists) {
					try {
						const stat = Deno.statSync(path);
						if (!stat.isFile) {
							result.warnings.push({
								field: `${field}[${i}]`,
								message: 'Layout path does not point to a file',
								value: path,
								severity: 'high',
							});
						}
					} catch {
						result.warnings.push({
							field: `${field}[${i}]`,
							message: 'Layout file does not exist',
							value: path,
							severity: 'high',
						});
					}
				}
			}
		}
	}

	private validateHandlerLogic(handler: LayoutHandler, result: ValidationResult): void {
		// Check priority range
		if (handler.priority < 0) {
			result.warnings.push({
				field: 'priority',
				message: 'Negative priority values may cause unexpected ordering',
				value: handler.priority,
				severity: 'medium',
			});
		}

		if (handler.priority > 1000) {
			result.warnings.push({
				field: 'priority',
				message: 'Very high priority values may cause unexpected ordering',
				value: handler.priority,
				severity: 'low',
			});
		}

		// Check path format
		if (!handler.path.includes('_layout')) {
			result.warnings.push({
				field: 'path',
				message: 'Handler path should contain "_layout"',
				value: handler.path,
				severity: 'medium',
			});
		}

		// Check component
		if (!handler.component) {
			result.errors.push({
				field: 'component',
				message: 'Layout handler must have a component',
				code: 'MISSING_COMPONENT',
			});
			result.valid = false;
		}
	}

	private validateContextLogic(context: LayoutContext, result: ValidationResult): void {
		// Check request method
		if (context.request && typeof context.request.method === 'string') {
			const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
			if (!validMethods.includes(context.request.method.toUpperCase())) {
				result.warnings.push({
					field: 'request.method',
					message: 'Unusual HTTP method detected',
					value: context.request.method,
					severity: 'low',
				});
			}
		}

		// Check params
		if (context.params) {
			for (const [key, value] of Object.entries(context.params)) {
				if (typeof value !== 'string') {
					result.warnings.push({
						field: `params.${key}`,
						message: 'Parameter value should be a string',
						value: typeof value,
						severity: 'medium',
					});
				}
			}
		}

		// Check state size
		if (context.state && context.state instanceof Map) {
			if (context.state.size > 100) {
				result.warnings.push({
					field: 'state',
					message: 'Large state object detected, may impact performance',
					value: context.state.size,
					severity: 'medium',
				});
			}
		}
	}

	private validateChainLogic(handlers: LayoutHandler[], result: ValidationResult): void {
		// Check for duplicate paths
		const paths = handlers.map(h => h.path);
		const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
		if (duplicates.length > 0) {
			result.errors.push({
				field: 'handlers',
				message: `Duplicate layout paths found: ${[...new Set(duplicates)].join(', ')}`,
				code: 'DUPLICATE_PATHS',
			});
			result.valid = false;
		}

		// Check priority ordering
		const priorities = handlers.map(h => h.priority);
		const sortedPriorities = [...priorities].sort((a, b) => a - b);
		if (JSON.stringify(priorities) !== JSON.stringify(sortedPriorities)) {
			result.warnings.push({
				field: 'handlers',
				message: 'Layout handlers are not ordered by priority',
				severity: 'medium',
			});
		}

		// Check for too many layouts
		if (handlers.length > 10) {
			result.warnings.push({
				field: 'handlers',
				message: 'Large number of layouts in chain may impact performance',
				value: handlers.length,
				severity: 'medium',
			});
		}
	}
}

// Error reporting utilities
export class LayoutErrorReporter {
	private errors: Array<{
		timestamp: number;
		type: string;
		message: string;
		context?: any;
		stack?: string;
	}> = [];

	reportValidationError(result: ValidationResult, context?: any): void {
		if (!result.valid) {
			for (const error of result.errors) {
				this.errors.push({
					timestamp: Date.now(),
					type: 'validation_error',
					message: `${error.field}: ${error.message}`,
					context: { ...context, error },
				});
			}
		}

		// Report high-severity warnings as errors
		for (const warning of result.warnings) {
			if (warning.severity === 'high') {
				this.errors.push({
					timestamp: Date.now(),
					type: 'validation_warning',
					message: `${warning.field}: ${warning.message}`,
					context: { ...context, warning },
				});
			}
		}
	}

	reportRuntimeError(error: Error, type: string, context?: any): void {
		this.errors.push({
			timestamp: Date.now(),
			type,
			message: error.message,
			context,
			stack: error.stack,
		});
	}

	getErrors(
		type?: string,
		since?: number
	): Array<{
		timestamp: number;
		type: string;
		message: string;
		context?: any;
		stack?: string;
	}> {
		let filteredErrors = [...this.errors];

		if (type) {
			filteredErrors = filteredErrors.filter(err => err.type === type);
		}

		if (since) {
			filteredErrors = filteredErrors.filter(err => err.timestamp >= since);
		}

		return filteredErrors;
	}

	clearErrors(olderThan?: number): number {
		const initialCount = this.errors.length;

		if (olderThan) {
			this.errors = this.errors.filter(err => err.timestamp >= olderThan);
		} else {
			this.errors = [];
		}

		return initialCount - this.errors.length;
	}

	generateReport(): string {
		const errorsByType = new Map<string, number>();
		const recentErrors = this.errors.filter(
			err => Date.now() - err.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
		);

		for (const error of recentErrors) {
			errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
		}

		const report = {
			timestamp: new Date().toISOString(),
			summary: {
				totalErrors: this.errors.length,
				recentErrors: recentErrors.length,
				errorsByType: Object.fromEntries(errorsByType),
			},
			recentErrors: recentErrors.slice(-10), // Last 10 errors
		};

		return JSON.stringify(report, null, 2);
	}
}

// Default validation options
export const defaultValidationOptions: ConfigValidationOptions = {
	strict: true,
	allowUnknownFields: false,
	validatePaths: true,
	checkFileExists: false, // Disabled by default to avoid file system access in tests
};

// Global instances
export const layoutConfigValidator = new LayoutConfigValidator(defaultValidationOptions);
export const layoutErrorReporter = new LayoutErrorReporter();
