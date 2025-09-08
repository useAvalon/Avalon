import { type ImportConfig, validateImportConfig } from '../schemas/index.ts';

/**
 * Creates a validated `ImportConfig` object containing the specified names and source module.
 *
 * @param names - An array of strings representing the names to be imported.
 * @param from - A string representing the source module from which the names are imported.
 * @returns A validated `ImportConfig` object with the provided names and source module.
 * @throws {ValidationError} When the input parameters are invalid
 */
export function from(names: string[], from: string): ImportConfig {
	const config = { names, from };

	// Validate the config before returning
	return validateImportConfig(config);
}
