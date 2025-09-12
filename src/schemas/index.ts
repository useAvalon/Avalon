import { z } from 'zod';
import { RenderOptionsSchema } from './core.ts';
import { ServerConfigSchema } from './server.ts';

// Re-export all schemas and types
export * from './core.ts';
export * from './server.ts';
export * from './api.ts';

// === Explicit Type Definitions ===

// Use z.infer to get the actual output types from schemas
type RenderOptions = z.infer<typeof RenderOptionsSchema>;
type ServerConfig = z.infer<typeof ServerConfigSchema>;

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
		return this.zodError.errors.map((error): string => {
			const path = error.path.length > 0 ? `${error.path.join('.')}: ` : '';
			return `${path}${error.message}`;
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
export function safeValidate<TOutput, TDef extends z.ZodTypeDef = z.ZodTypeDef, TInput = TOutput>(
	schema: z.ZodType<TOutput, TDef, TInput>,
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
export function validate<TOutput, TDef extends z.ZodTypeDef = z.ZodTypeDef, TInput = TOutput>(
	schema: z.ZodType<TOutput, TDef, TInput>,
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
} as const;

/**
 * Safe validation utilities with explicit return types
 */
export const safeValidators = {
	renderOptions: (data: unknown): ValidationResult<RenderOptions> =>
		safeValidate(RenderOptionsSchema, data, 'Invalid render options'),

	serverConfig: (data: unknown): ValidationResult<ServerConfig> =>
		safeValidate(ServerConfigSchema, data, 'Invalid server configuration'),
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
			error instanceof ValidationError ? error : createValidationError('Batch validation failed', new z.ZodError([]));

		return { success: false, error: validationError };
	}
}

// === Utility Type Extractors ===
export type ExtractValidationData<T> = T extends ValidationResult<infer U> ? U : never;
export type ExtractSchemaInput<T> = T extends z.ZodType<unknown, z.ZodTypeDef, infer U> ? U : never;
export type ExtractSchemaOutput<T> = T extends z.ZodType<infer U> ? U : never;
