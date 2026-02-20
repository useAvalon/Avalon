import { z } from 'zod';
import { RenderOptionsSchema } from './core.ts';
import { ServerConfigSchema } from './server.ts';
import { MiddlewareConfigSchema, MiddlewareDiscoveryOptionsSchema } from './middleware.ts';
import {
	LayoutContextSchema,
	LayoutDataSchema,
	LayoutHandlerSchema,
	LayoutDiscoveryOptionsSchema as LayoutDiscoverySchema,
	LayoutConfigSchema,
	ResolvedLayoutSchema,
} from './layout.ts';
import {
	FileSystemRouteSchema,
	RoutePageModuleSchema,
	RouteDiscoveryOptionsSchema,
	FileSystemRouterConfigSchema,
	MetadataSchema,
	ResolvedMetadataSchema,
} from './routing.ts';
import type { RenderOptions } from './core.ts';
import type { ServerConfig } from './server.ts';
import type { MiddlewareConfig, MiddlewareDiscoveryOptions } from './middleware.ts';
import type {
	LayoutContext,
	LayoutData,
	LayoutHandler,
	LayoutDiscoveryOptions,
	LayoutConfig,
	ResolvedLayout,
} from './layout.ts';
import type {
	FileSystemRoute,
	RoutePageModule,
	RouteDiscoveryOptions,
	FileSystemRouterConfig,
	Metadata,
	ResolvedMetadata,
} from './routing.ts';

// Re-export all schemas and types
export * from './core.ts';
export * from './server.ts';
export * from './api.ts';
export * from './middleware.ts';
export * from './layout.ts';
export * from './routing.ts';
export * from './integration-config.ts';

// === Validation Result Types ===

/**
 * Successful validation result
 */
export interface ValidationSuccess<T> {
	success: true;
	data: T;
}

/**
 * Failed validation result
 */
export interface ValidationFailure {
	success: false;
	error: ValidationError;
}

/**
 * Union type for validation results
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Combined validation utilities for common operations
 */
export class ValidationError extends Error {
	constructor(message: string, public readonly zodError: z.ZodError) {
		super(message);
		this.name = 'ValidationError';
	}

	/**
	 * Get formatted error messages
	 */
	getFormattedErrors(): string[] {
		return this.zodError.issues.map((issue): string => {
			const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
			return `${path}${issue.message}`;
		});
	}

	/**
	 * Get error messages as a single string
	 */
	getErrorMessage(): string {
		return this.getFormattedErrors().join('; ');
	}
}

/**
 * Helper function to create validation error
 */
export function createValidationError(message: string, zodError: z.ZodError): ValidationError {
	return new ValidationError(message, zodError);
}

/**
 * Generic safe validator that returns a result object
 */
export function safeValidate<TOutput>(
	schema: z.ZodType<TOutput>,
	data: unknown,
	errorMessage = 'Validation failed'
): ValidationResult<TOutput> {
	const result = schema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	} else {
		return {
			success: false,
			error: createValidationError(errorMessage, result.error),
		};
	}
}

/**
 * Generic validator that throws on error
 */
export function validate<TOutput>(
	schema: z.ZodType<TOutput>,
	data: unknown,
	errorMessage = 'Validation failed'
): TOutput {
	const result = schema.safeParse(data);

	if (result.success) {
		return result.data;
	} else {
		throw createValidationError(errorMessage, result.error);
	}
}

// === Validation Utilities with Explicit Return Types ===

/**
 * Validation utilities with better error messages
 */
export const validators = {
	renderOptions: (data: unknown): RenderOptions => validate(RenderOptionsSchema, data, 'Invalid render options'),

	serverConfig: (data: unknown): ServerConfig => validate(ServerConfigSchema, data, 'Invalid server configuration'),

	middlewareConfig: (data: unknown): MiddlewareConfig =>
		validate(MiddlewareConfigSchema, data, 'Invalid middleware configuration'),

	middlewareDiscoveryOptions: (data: unknown): MiddlewareDiscoveryOptions =>
		validate(MiddlewareDiscoveryOptionsSchema, data, 'Invalid middleware discovery options'),

	layoutContext: (data: unknown): LayoutContext => validate(LayoutContextSchema, data, 'Invalid layout context'),

	layoutData: (data: unknown): LayoutData => validate(LayoutDataSchema, data, 'Invalid layout data'),

	layoutHandler: (data: unknown): LayoutHandler => validate(LayoutHandlerSchema, data, 'Invalid layout handler'),

	layoutDiscoveryOptions: (data: unknown): LayoutDiscoveryOptions =>
		validate(LayoutDiscoverySchema, data, 'Invalid layout discovery options'),

	layoutConfig: (data: unknown): LayoutConfig => validate(LayoutConfigSchema, data, 'Invalid layout config'),

	resolvedLayout: (data: unknown): ResolvedLayout => validate(ResolvedLayoutSchema, data, 'Invalid resolved layout'),

	fileSystemRoute: (data: unknown): FileSystemRoute =>
		validate(FileSystemRouteSchema, data, 'Invalid file system route'),

	routePageModule: (data: unknown): RoutePageModule =>
		validate(RoutePageModuleSchema, data, 'Invalid route page module'),

	routeDiscoveryOptions: (data: unknown): RouteDiscoveryOptions =>
		validate(RouteDiscoveryOptionsSchema, data, 'Invalid route discovery options'),

	fileSystemRouterConfig: (data: unknown): FileSystemRouterConfig =>
		validate(FileSystemRouterConfigSchema, data, 'Invalid file system router config'),

	metadata: (data: unknown): Metadata => validate(MetadataSchema, data, 'Invalid metadata'),

	resolvedMetadata: (data: unknown): ResolvedMetadata =>
		validate(ResolvedMetadataSchema, data, 'Invalid resolved metadata'),
} as const;

/**
 * Safe validation utilities with explicit return types
 */
export const safeValidators = {
	renderOptions: (data: unknown): ValidationResult<RenderOptions> =>
		safeValidate(RenderOptionsSchema, data, 'Invalid render options'),

	serverConfig: (data: unknown): ValidationResult<ServerConfig> =>
		safeValidate(ServerConfigSchema, data, 'Invalid server configuration'),

	middlewareConfig: (data: unknown): ValidationResult<MiddlewareConfig> =>
		safeValidate(MiddlewareConfigSchema, data, 'Invalid middleware configuration'),

	middlewareDiscoveryOptions: (data: unknown): ValidationResult<MiddlewareDiscoveryOptions> =>
		safeValidate(MiddlewareDiscoveryOptionsSchema, data, 'Invalid middleware discovery options'),

	layoutContext: (data: unknown): ValidationResult<LayoutContext> =>
		safeValidate(LayoutContextSchema, data, 'Invalid layout context'),

	layoutData: (data: unknown): ValidationResult<LayoutData> =>
		safeValidate(LayoutDataSchema, data, 'Invalid layout data'),

	layoutHandler: (data: unknown): ValidationResult<LayoutHandler> =>
		safeValidate(LayoutHandlerSchema, data, 'Invalid layout handler'),

	layoutDiscoveryOptions: (data: unknown): ValidationResult<LayoutDiscoveryOptions> =>
		safeValidate(LayoutDiscoverySchema, data, 'Invalid layout discovery options'),

	layoutConfig: (data: unknown): ValidationResult<LayoutConfig> =>
		safeValidate(LayoutConfigSchema, data, 'Invalid layout config'),

	resolvedLayout: (data: unknown): ValidationResult<ResolvedLayout> =>
		safeValidate(ResolvedLayoutSchema, data, 'Invalid resolved layout'),

	fileSystemRoute: (data: unknown): ValidationResult<FileSystemRoute> =>
		safeValidate(FileSystemRouteSchema, data, 'Invalid file system route'),

	routePageModule: (data: unknown): ValidationResult<RoutePageModule> =>
		safeValidate(RoutePageModuleSchema, data, 'Invalid route page module'),

	routeDiscoveryOptions: (data: unknown): ValidationResult<RouteDiscoveryOptions> =>
		safeValidate(RouteDiscoveryOptionsSchema, data, 'Invalid route discovery options'),

	fileSystemRouterConfig: (data: unknown): ValidationResult<FileSystemRouterConfig> =>
		safeValidate(FileSystemRouterConfigSchema, data, 'Invalid file system router config'),

	metadata: (data: unknown): ValidationResult<Metadata> => safeValidate(MetadataSchema, data, 'Invalid metadata'),

	resolvedMetadata: (data: unknown): ValidationResult<ResolvedMetadata> =>
		safeValidate(ResolvedMetadataSchema, data, 'Invalid resolved metadata'),
} as const;

/**
 * Development mode validation helpers with explicit return types
 */
export const devValidators = {
	/**
	 * Validates render options and logs warnings instead of throwing
	 */
	renderOptionsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<RenderOptions> = safeValidators.renderOptions(data);
		if (!result.success) {
			console.warn(`Render options validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates server config and logs warnings instead of throwing
	 */
	serverConfigSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<ServerConfig> = safeValidators.serverConfig(data);
		if (!result.success) {
			console.warn(`Server config validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates middleware config and logs warnings instead of throwing
	 */
	middlewareConfigSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<MiddlewareConfig> = safeValidators.middlewareConfig(data);
		if (!result.success) {
			console.warn(`Middleware config validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates middleware discovery options and logs warnings instead of throwing
	 */
	middlewareDiscoveryOptionsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<MiddlewareDiscoveryOptions> = safeValidators.middlewareDiscoveryOptions(data);
		if (!result.success) {
			console.warn(`Middleware discovery options validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},
} as const;

/**
 * Runtime Type Guards with Explicit Return Types
 */
export function isValidRenderOptions(data: unknown): data is RenderOptions {
	return safeValidators.renderOptions(data).success;
}

export function isValidServerConfig(data: unknown): data is ServerConfig {
	return safeValidators.serverConfig(data).success;
}

export function isValidMiddlewareConfig(data: unknown): data is MiddlewareConfig {
	return safeValidators.middlewareConfig(data).success;
}

export function isValidMiddlewareDiscoveryOptions(data: unknown): data is MiddlewareDiscoveryOptions {
	return safeValidators.middlewareDiscoveryOptions(data).success;
}

export function isValidFileSystemRoute(data: unknown): data is FileSystemRoute {
	return safeValidators.fileSystemRoute(data).success;
}

export function isValidRoutePageModule(data: unknown): data is RoutePageModule {
	return safeValidators.routePageModule(data).success;
}

export function isValidRouteDiscoveryOptions(data: unknown): data is RouteDiscoveryOptions {
	return safeValidators.routeDiscoveryOptions(data).success;
}

export function isValidFileSystemRouterConfig(data: unknown): data is FileSystemRouterConfig {
	return safeValidators.fileSystemRouterConfig(data).success;
}

export function isValidMetadata(data: unknown): data is Metadata {
	return safeValidators.metadata(data).success;
}

export function isValidResolvedMetadata(data: unknown): data is ResolvedMetadata {
	return safeValidators.resolvedMetadata(data).success;
}

// === Batch Validation Utilities ===
export function validateBatch<T extends Record<string, unknown>>(
	schemas: { [K in keyof T]: z.ZodType<T[K]> },
	data: { [K in keyof T]: unknown }
): T {
	const result: Partial<T> = {};
	const errors: string[] = [];

	for (const [key, schema] of Object.entries(schemas) as Array<[keyof T, z.ZodType<T[keyof T]>]>) {
		try {
			result[key] = validate(schema, data[key], `Invalid ${String(key)}`);
		} catch (error) {
			if (error instanceof ValidationError) {
				errors.push(`${String(key)}: ${error.getErrorMessage()}`);
			} else {
				errors.push(`${String(key)}: Unknown validation error`);
			}
		}
	}

	if (errors.length > 0) {
		throw new Error(`Batch validation failed: ${errors.join('; ')}`);
	}

	return result as T;
}

export function safeValidateBatch<T extends Record<string, unknown>>(
	schemas: { [K in keyof T]: z.ZodType<T[K]> },
	data: { [K in keyof T]: unknown }
): ValidationResult<T> {
	try {
		const result = validateBatch(schemas, data);
		return { success: true, data: result };
	} catch (error) {
		const validationError =
			error instanceof ValidationError
				? error
				: createValidationError(
						'Batch validation failed',
						new z.ZodError([{ code: 'custom', message: String(error), path: [] }])
					);

		return { success: false, error: validationError };
	}
}

// === Utility Type Extractors ===
export type ExtractValidationData<T> = T extends ValidationResult<infer U> ? U : never;
export type ExtractSchemaInput<T> = T extends z.ZodType<infer U> ? U : never;
export type ExtractSchemaOutput<T> = T extends z.ZodType<infer U> ? U : never;
