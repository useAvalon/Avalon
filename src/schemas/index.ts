import { z } from 'zod';
import { ImportConfigSchema, RenderOptionsSchema } from './core.ts';
import { ServerConfigSchema } from './server.ts';
import {
	PreactIslandPropsSchema,
	SolidIslandPropsSchema,
	VanillaIslandPropsSchema,
	VueIslandPropsSchema,
} from './frameworks.ts';

// Re-export all schemas and types
export * from './core.ts';
export * from './frameworks.ts';
export * from './server.ts';
export * from './api.ts';

// === Explicit Type Definitions ===

// Use z.infer to get the actual output types from schemas
type ImportConfig = z.infer<typeof ImportConfigSchema>;
type RenderOptions = z.infer<typeof RenderOptionsSchema>;
type ServerConfig = z.infer<typeof ServerConfigSchema>;
type PreactIslandProps = z.infer<typeof PreactIslandPropsSchema>;
type SolidIslandProps = z.infer<typeof SolidIslandPropsSchema>;
type VueIslandProps = z.infer<typeof VueIslandPropsSchema>;
type VanillaIslandProps = z.infer<typeof VanillaIslandPropsSchema>;

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
	importConfig: (data: unknown): ImportConfig => validate(ImportConfigSchema, data, 'Invalid import configuration'),

	renderOptions: (data: unknown): RenderOptions => validate(RenderOptionsSchema, data, 'Invalid render options'),

	serverConfig: (data: unknown): ServerConfig => validate(ServerConfigSchema, data, 'Invalid server configuration'),

	preactProps: (data: unknown): PreactIslandProps =>
		validate(PreactIslandPropsSchema, data, 'Invalid Preact island props'),

	solidProps: (data: unknown): SolidIslandProps => validate(SolidIslandPropsSchema, data, 'Invalid Solid island props'),

	vueProps: (data: unknown): VueIslandProps => validate(VueIslandPropsSchema, data, 'Invalid Vue island props'),

	vanillaProps: (data: unknown): VanillaIslandProps =>
		validate(VanillaIslandPropsSchema, data, 'Invalid Vanilla island props'),
} as const;

/**
 * Safe validation utilities with explicit return types
 */
export const safeValidators = {
	importConfig: (data: unknown): ValidationResult<ImportConfig> =>
		safeValidate(ImportConfigSchema, data, 'Invalid import configuration'),

	renderOptions: (data: unknown): ValidationResult<RenderOptions> =>
		safeValidate(RenderOptionsSchema, data, 'Invalid render options'),

	serverConfig: (data: unknown): ValidationResult<ServerConfig> =>
		safeValidate(ServerConfigSchema, data, 'Invalid server configuration'),

	preactProps: (data: unknown): ValidationResult<PreactIslandProps> =>
		safeValidate(PreactIslandPropsSchema, data, 'Invalid Preact island props'),

	solidProps: (data: unknown): ValidationResult<SolidIslandProps> =>
		safeValidate(SolidIslandPropsSchema, data, 'Invalid Solid island props'),

	vueProps: (data: unknown): ValidationResult<VueIslandProps> =>
		safeValidate(VueIslandPropsSchema, data, 'Invalid Vue island props'),

	vanillaProps: (data: unknown): ValidationResult<VanillaIslandProps> =>
		safeValidate(VanillaIslandPropsSchema, data, 'Invalid Vanilla island props'),
} as const;

/**
 * Development mode validation helpers with explicit return types
 */
export const devValidators = {
	/**
	 * Validates import config and logs warnings instead of throwing
	 */
	importConfigSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<ImportConfig> = safeValidators.importConfig(data);
		if (!result.success) {
			console.warn(`Import config validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

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
	 * Validates Preact props and logs warnings instead of throwing
	 */
	preactPropsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<PreactIslandProps> = safeValidators.preactProps(data);
		if (!result.success) {
			console.warn(`Preact props validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates Solid props and logs warnings instead of throwing
	 */
	solidPropsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<SolidIslandProps> = safeValidators.solidProps(data);
		if (!result.success) {
			console.warn(`Solid props validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates Vue props and logs warnings instead of throwing
	 */
	vuePropsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<VueIslandProps> = safeValidators.vueProps(data);
		if (!result.success) {
			console.warn(`Vue props validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},

	/**
	 * Validates Vanilla props and logs warnings instead of throwing
	 */
	vanillaPropsSoft: (data: unknown, context = 'unknown'): boolean => {
		const result: ValidationResult<VanillaIslandProps> = safeValidators.vanillaProps(data);
		if (!result.success) {
			console.warn(`Vanilla props validation warning in ${context}:`, result.error.getErrorMessage());
			return false;
		}
		return true;
	},
} as const;

/**
 * Runtime Type Guards with Explicit Return Types
 */
export function isValidImportConfig(data: unknown): data is ImportConfig {
	return safeValidators.importConfig(data).success;
}

export function isValidRenderOptions(data: unknown): data is RenderOptions {
	return safeValidators.renderOptions(data).success;
}

export function isValidServerConfig(data: unknown): data is ServerConfig {
	return safeValidators.serverConfig(data).success;
}

export function isValidPreactIslandProps(data: unknown): data is PreactIslandProps {
	return safeValidators.preactProps(data).success;
}

export function isValidSolidIslandProps(data: unknown): data is SolidIslandProps {
	return safeValidators.solidProps(data).success;
}

export function isValidVueIslandProps(data: unknown): data is VueIslandProps {
	return safeValidators.vueProps(data).success;
}

export function isValidVanillaIslandProps(data: unknown): data is VanillaIslandProps {
	return safeValidators.vanillaProps(data).success;
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
