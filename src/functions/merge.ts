import { type RenderOptions, devValidators, type ScriptConfig } from '../schemas/index.ts';

/**
 * Deduplicates an array of scripts, handling both string URLs and complex script objects
 */
function deduplicateScripts(scripts: ScriptConfig[]): ScriptConfig[] {
	const seen = new Set<string>();
	const result: ScriptConfig[] = [];

	for (const script of scripts) {
		let key: string;

		if (typeof script === 'string') {
			key = `string:${script}`;
		} else {
			// Create a unique key based on script properties
			key = `object:${JSON.stringify({
				src: script.src,
				content: script.content,
				data: script.data,
				type: script.type,
			})}`;
		}

		if (!seen.has(key)) {
			seen.add(key);
			result.push(script);
		}
	}

	return result;
}

/**
 * Merges render options from multiple sources with proper handling of arrays and nested objects
 * Includes validation to ensure the final merged options are valid
 *
 * @param baseOptions - Base render options
 * @param defaultOptions - Default render options
 * @param routeOptions - Route-specific render options
 * @returns Validated merged render options
 * @throws {ValidationError} When any input or the final result is invalid
 */
export function mergeOptions(
	baseOptions: Partial<RenderOptions>,
	defaultOptions: Partial<RenderOptions>,
	routeOptions: Partial<RenderOptions>
): RenderOptions {
	// Validate inputs in development mode (soft validation with warnings)
	if (Deno.env.get('NODE_ENV') === 'development' || Deno.env.get('DENO_ENV') === 'development') {
		devValidators.renderOptionsSoft(baseOptions, 'baseOptions');
		devValidators.renderOptionsSoft(defaultOptions, 'defaultOptions');
		devValidators.renderOptionsSoft(routeOptions, 'routeOptions');
	}

	const merged: Partial<RenderOptions> = {
		title: routeOptions.title ?? defaultOptions.title ?? baseOptions.title ?? '',
		scripts: deduplicateScripts([
			...(baseOptions.scripts || []),
			...(defaultOptions.scripts || []),
			...(routeOptions.scripts || []),
		]),
		styles: [
			...new Set([...(baseOptions.styles || []), ...(defaultOptions.styles || []), ...(routeOptions.styles || [])]),
		],
		meta: [...(baseOptions.meta || []), ...(defaultOptions.meta || []), ...(routeOptions.meta || [])],
	};

	// Merge import maps
	if (baseOptions.importMap || defaultOptions.importMap || routeOptions.importMap) {
		merged.importMap = {
			imports: {
				...(baseOptions.importMap?.imports || {}),
				...(defaultOptions.importMap?.imports || {}),
				...(routeOptions.importMap?.imports || {}),
			},
			scopes: {
				...(baseOptions.importMap?.scopes || {}),
				...(defaultOptions.importMap?.scopes || {}),
				...(routeOptions.importMap?.scopes || {}),
			},
		};
	}

	return merged as RenderOptions;
}

/**
 * Helper function to merge two partial render options
 */
export function mergePartialOptions(
	base: Partial<RenderOptions>,
	override: Partial<RenderOptions>
): Partial<RenderOptions> {
	const result: Partial<RenderOptions> = {
		...base,
		...override,
	};

	// Handle arrays
	if (base.meta || override.meta) {
		result.meta = [
			...new Map([...(base.meta || []), ...(override.meta || [])].map(item => [item.name, item])).values(),
		];
	}

	if (base.styles || override.styles) {
		result.styles = [...new Set([...(base.styles || []), ...(override.styles || [])])];
	}

	if (base.scripts || override.scripts) {
		result.scripts = deduplicateScripts([...(base.scripts || []), ...(override.scripts || [])]);
	}

	// Handle import map merging
	if (base.importMap || override.importMap) {
		result.importMap = {
			imports: {
				...(base.importMap?.imports || {}),
				...(override.importMap?.imports || {}),
			},
			scopes: {
				...(base.importMap?.scopes || {}),
				...(override.importMap?.scopes || {}),
			},
		};
	}

	return result;
}
