import { z } from 'zod';

/**
 * Schema for import configuration
 */
export const ImportConfigSchema: z.ZodObject<{
	names: z.ZodArray<z.ZodString, 'many'>;
	from: z.ZodString;
}> = z.object({
	names: z.array(z.string().min(1)).min(1),
	from: z.string().min(1),
});

/**
 * Schema for island ID format
 */
export const IslandIdSchema: z.ZodString = z.string().regex(/^island-[\w-]+$/, {
	message: "Island ID must start with 'island-' followed by valid characters",
});

/**
 * Schema for island condition types
 */
export const IslandConditionSchema: z.ZodOptional<
	z.ZodNullable<z.ZodUnion<[z.ZodEnum<['on:visible', 'on:idle', 'on:interaction', 'on:client']>, z.ZodString]>>
> = z
	.union([
		z.enum(['on:visible', 'on:idle', 'on:interaction', 'on:client']),
		z.string().regex(/^media:/, 'Media query conditions must start with "media:"'),
	])
	.nullable()
	.optional();

/**
 * Base schema for island props
 */
export const IslandPropsSchema: z.ZodObject<{
	condition: typeof IslandConditionSchema;
	imports: z.ZodOptional<z.ZodArray<typeof ImportConfigSchema>>;
}> = z.object({
	condition: IslandConditionSchema,
	imports: z.array(ImportConfigSchema).optional(),
});

/**
 * Schema for component metadata
 */
export const ComponentMetadataSchema: z.ZodObject<{
	imports: z.ZodOptional<
		z.ZodArray<
			z.ZodObject<{
				names: z.ZodArray<z.ZodString, 'many'>;
				from: z.ZodString;
			}>,
			'many'
		>
	>;
	displayName: z.ZodOptional<z.ZodString>;
}> = z.object({
	imports: z.array(ImportConfigSchema).optional(),
	displayName: z.string().optional(),
});

/**
 * Schema for meta tags
 */
export const MetaTagSchema: z.ZodObject<{
	name: z.ZodString;
	content: z.ZodString;
}> = z.object({
	name: z.string().min(1),
	content: z.string(),
});

/**
 * Script configuration schema - supports both simple URLs and complex script objects
 */
export const ScriptConfigSchema: z.ZodUnion<[
	z.ZodString,
	z.ZodEffects<
		z.ZodObject<{
			src: z.ZodOptional<z.ZodString>;
			content: z.ZodOptional<z.ZodString>;
			data: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown, 'many'>]>>;
			type: z.ZodOptional<z.ZodString>;
			async: z.ZodOptional<z.ZodBoolean>;
			defer: z.ZodOptional<z.ZodBoolean>;
			crossorigin: z.ZodOptional<z.ZodEnum<['anonymous', 'use-credentials']>>;
			integrity: z.ZodOptional<z.ZodString>;
			nomodule: z.ZodOptional<z.ZodBoolean>;
			referrerpolicy: z.ZodOptional<z.ZodEnum<[
				'no-referrer',
				'no-referrer-when-downgrade',
				'origin',
				'origin-when-cross-origin',
				'same-origin',
				'strict-origin',
				'strict-origin-when-cross-origin',
				'unsafe-url'
			]>>;
			attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
		}>,
		{
			src?: string;
			content?: string;
			data?: Record<string, unknown> | unknown[];
			type?: string;
			async?: boolean;
			defer?: boolean;
			crossorigin?: 'anonymous' | 'use-credentials';
			integrity?: string;
			nomodule?: boolean;
			referrerpolicy?:
				| 'no-referrer'
				| 'no-referrer-when-downgrade'
				| 'origin'
				| 'origin-when-cross-origin'
				| 'same-origin'
				| 'strict-origin'
				| 'strict-origin-when-cross-origin'
				| 'unsafe-url';
			attributes?: Record<string, string>;
		}
	>
]> = z.union([
	// Simple string URL (backward compatible)
	z.string().min(1),
	// Complex script object with attributes
	z
		.object({
			src: z.string().min(1).optional(),
			content: z.string().optional(), // For inline scripts
			data: z.record(z.unknown()).or(z.array(z.unknown())).optional(), // For structured data (JSON-LD)
			type: z.string().optional(),
			async: z.boolean().optional(),
			defer: z.boolean().optional(),
			crossorigin: z.enum(['anonymous', 'use-credentials']).optional(),
			integrity: z.string().optional(),
			nomodule: z.boolean().optional(),
			referrerpolicy: z
				.enum([
					'no-referrer',
					'no-referrer-when-downgrade',
					'origin',
					'origin-when-cross-origin',
					'same-origin',
					'strict-origin',
					'strict-origin-when-cross-origin',
					'unsafe-url',
				])
				.optional(),
			// Allow custom attributes
			attributes: z.record(z.string()).optional(),
		})
		.refine(data => data.src || data.content || data.data, {
			message: "Script must have either 'src', 'content', or 'data'",
		}),
]);

/**
 * Standard import map schema that matches the MDN specification
 */
export const ImportMapSchema: z.ZodObject<{
	imports: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
	scopes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>>;
}> = z.object({
	imports: z.record(z.string(), z.string()).optional(),
	scopes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

/**
 * Base schema for render options structure
 */
export const RenderOptionsBaseSchema: z.ZodObject<{
	title: z.ZodDefault<z.ZodString>;
	scripts: z.ZodDefault<z.ZodArray<typeof ScriptConfigSchema, 'many'>>;
	styles: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
	meta: z.ZodDefault<
		z.ZodArray<
			z.ZodObject<{
				name: z.ZodString;
				content: z.ZodString;
			}>,
			'many'
		>
	>;
	importMap: z.ZodOptional<typeof ImportMapSchema>;
}> = z.object({
	title: z.string().default(''),
	scripts: z.array(ScriptConfigSchema).default([]),
	styles: z.array(z.string().min(1)).default([]),
	meta: z.array(MetaTagSchema).default([
		{ name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
		{ name: 'charset', content: 'UTF-8' },
	]),
	importMap: ImportMapSchema.optional(),
});

/**
 * Full render options schema with transform for complete validation
 */
export const RenderOptionsSchema: z.ZodEffects<
	z.ZodObject<{
		title: z.ZodDefault<z.ZodString>;
		scripts: z.ZodDefault<z.ZodArray<typeof ScriptConfigSchema, 'many'>>;
		styles: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
		meta: z.ZodDefault<
			z.ZodArray<
				z.ZodObject<{
					name: z.ZodString;
					content: z.ZodString;
				}>,
				'many'
			>
		>;
		importMap: z.ZodOptional<
			z.ZodObject<{
				imports: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
				scopes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>>;
			}>
		>;
	}>,
	{
		title: string;
		scripts: Array<
			| string
			| {
					src?: string;
					content?: string;
					data?: Record<string, unknown> | unknown[];
					type?: string;
					async?: boolean;
					defer?: boolean;
					crossorigin?: 'anonymous' | 'use-credentials';
					integrity?: string;
					nomodule?: boolean;
					referrerpolicy?:
						| 'no-referrer'
						| 'no-referrer-when-downgrade'
						| 'origin'
						| 'origin-when-cross-origin'
						| 'same-origin'
						| 'strict-origin'
						| 'strict-origin-when-cross-origin'
						| 'unsafe-url';
					attributes?: Record<string, string>;
			  }
		>;
		styles: string[];
		meta: Array<{ name: string; content: string }>;
		importMap?: {
			imports?: Record<string, string>;
			scopes?: Record<string, Record<string, string>>;
		};
	}
> = RenderOptionsBaseSchema.transform(data => ({
	// Ensure all required fields have values
	title: data.title,
	scripts: data.scripts,
	styles: data.styles,
	meta: data.meta,
	importMap: data.importMap
		? {
				imports: data.importMap.imports,
				scopes: data.importMap.scopes,
		  }
		: undefined,
}));

/**
 * Partial render options schema for optional usage
 */
export const PartialRenderOptionsSchema: z.ZodType<{
	title?: string;
	scripts?: Array<
		| string
		| {
				src?: string;
				content?: string;
				data?: Record<string, unknown> | unknown[];
				type?: string;
				async?: boolean;
				defer?: boolean;
				crossorigin?: 'anonymous' | 'use-credentials';
				integrity?: string;
				nomodule?: boolean;
				referrerpolicy?:
					| 'no-referrer'
					| 'no-referrer-when-downgrade'
					| 'origin'
					| 'origin-when-cross-origin'
					| 'same-origin'
					| 'strict-origin'
					| 'strict-origin-when-cross-origin'
					| 'unsafe-url';
				attributes?: Record<string, string>;
		  }
	>;
	styles?: string[];
	meta?: Array<{ name: string; content: string }>;
	importMap?: {
		imports?: Record<string, string>;
		scopes?: Record<string, Record<string, string>>;
	};
}> = RenderOptionsBaseSchema.partial();

// === Derived TypeScript types ===

export type ImportConfig = z.infer<typeof ImportConfigSchema>;
export type IslandId = string;
export type IslandCondition = z.infer<typeof IslandConditionSchema>;
export type IslandProps = z.infer<typeof IslandPropsSchema>;
export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;
export type MetaTag = z.infer<typeof MetaTagSchema>;
export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
export type ImportMap = z.infer<typeof ImportMapSchema>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;
export type PartialRenderOptions = z.infer<typeof PartialRenderOptionsSchema>;

// Cleanup function type (can't be inferred from Zod)
export type CleanupFunction = () => void;

/**
 * Validation helpers
 */
export function validateImportConfig(data: unknown): ImportConfig {
	return ImportConfigSchema.parse(data);
}

export function validateRenderOptions(data: unknown): RenderOptions {
	return RenderOptionsSchema.parse(data);
}

export function validatePartialRenderOptions(data: unknown): PartialRenderOptions {
	return PartialRenderOptionsSchema.parse(data);
}

export function validateIslandProps(data: unknown): IslandProps {
	return IslandPropsSchema.parse(data);
}

export function validateComponentMetadata(data: unknown): ComponentMetadata {
	return ComponentMetadataSchema.parse(data);
}

/**
 * Safe validation helpers that return results
 */
export function safeValidateRenderOptions(data: unknown): z.SafeParseReturnType<unknown, RenderOptions> {
	return RenderOptionsSchema.safeParse(data);
}

export function safeValidatePartialRenderOptions(data: unknown): z.SafeParseReturnType<unknown, PartialRenderOptions> {
	return PartialRenderOptionsSchema.safeParse(data);
}

export function safeValidateImportConfig(data: unknown): z.SafeParseReturnType<unknown, ImportConfig> {
	return ImportConfigSchema.safeParse(data);
}
