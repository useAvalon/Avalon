/**
 * Error Classes for Avalon Vite Plugin
 *
 * This module provides custom error classes for configuration and integration errors.
 * These errors include contextual information to help developers quickly identify
 * and fix issues.
 */

/**
 * Thrown when configuration is invalid
 *
 * This error includes the specific field name and value that caused the error,
 * making it easier to identify and fix configuration issues.
 *
 * @example
 * ```ts
 * throw new AvalonConfigError(
 *   "must be a valid directory path",
 *   "islandsDir",
 *   123 // invalid value - should be a string
 * );
 * // Error: Avalon configuration error in 'islandsDir': must be a valid directory path
 * // Received value: 123
 * ```
 */
export class AvalonConfigError extends Error {
	/**
	 * The name of the configuration field that caused the error
	 */
	public readonly field: string;

	/**
	 * The invalid value that was provided
	 */
	public readonly value: unknown;

	constructor(message: string, field: string, value: unknown) {
		const valueStr = formatValue(value);
		super(`Avalon configuration error in '${field}': ${message}\nReceived value: ${valueStr}`);
		this.name = "AvalonConfigError";
		this.field = field;
		this.value = value;

		// Maintains proper stack trace for where error was thrown (V8 engines)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AvalonConfigError);
		}
	}
}

/**
 * Thrown when an integration fails to load or has an invalid name
 *
 * This error includes the integration name and optionally the underlying cause,
 * making it easier to diagnose integration loading issues.
 *
 * @example
 * ```ts
 * throw new IntegrationError(
 *   "Failed to activate integration. Is @useavalon/react installed?",
 *   "react",
 *   originalError
 * );
 * // Error: Integration 'react': Failed to activate integration. Is @useavalon/react installed?
 * ```
 */
export class IntegrationError extends Error {
	/**
	 * The name of the integration that caused the error
	 */
	public readonly integrationName: string;

	/**
	 * The original error that caused this error, if any
	 */
	public readonly originalCause?: Error;

	constructor(message: string, integrationName: string, originalCause?: Error) {
		super(`Integration '${integrationName}': ${message}`, { cause: originalCause });
		this.name = "IntegrationError";
		this.integrationName = integrationName;
		this.originalCause = originalCause;

		// Maintains proper stack trace for where error was thrown (V8 engines)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IntegrationError);
		}
	}
}

/**
 * Format a value for display in error messages
 *
 * @param value - The value to format
 * @returns A string representation of the value
 */
function formatValue(value: unknown): string {
	if (value === undefined) {
		return "undefined";
	}
	if (value === null) {
		return "null";
	}
	if (typeof value === "string") {
		return `"${value}"`;
	}
	if (typeof value === "function") {
		return "[Function]";
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "[]";
		}
		if (value.length <= 3) {
			return `[${value.map(formatValue).join(", ")}]`;
		}
		return `[${value.slice(0, 3).map(formatValue).join(", ")}, ... (${value.length} items)]`;
	}
	if (typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch {
			return "[Circular]";
		}
	}
	return String(value as string | number | boolean | bigint | symbol);
}
