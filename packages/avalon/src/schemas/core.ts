import { z } from 'zod';

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
export const ScriptConfigSchema: z.ZodUnion<
	[
		z.ZodString,
		z.ZodEffects<
			z.ZodObject<{
				src: z.ZodOptional<z.ZodString>;
				content: z.ZodOptional<z.ZodString>;
				data: z.ZodOptional<
					z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown, 'many'>, z.ZodString]>
				>;
				type: z.ZodOptional<z.ZodString>;
				async: z.ZodOptional<z.ZodBoolean>;
				defer: z.ZodOptional<z.ZodBoolean>;
				crossorigin: z.ZodOptional<z.ZodEnum<['anonymous', 'use-credentials']>>;
				integrity: z.ZodOptional<z.ZodString>;
				nomodule: z.ZodOptional<z.ZodBoolean>;
				referrerpolicy: z.ZodOptional<
					z.ZodEnum<
						[
							'no-referrer',
							'no-referrer-when-downgrade',
							'origin',
							'origin-when-cross-origin',
							'same-origin',
							'strict-origin',
							'strict-origin-when-cross-origin',
							'unsafe-url'
						]
					>
				>;
				attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
			}>,
			{
				src?: string;
				content?: string;
				data?: Record<string, unknown> | unknown[] | string;
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
	]
> = z.union([
	// Simple string URL (backward compatible)
	z.string().min(1),
	// Complex script object with attributes
	z
		.object({
			src: z.string().min(1).optional(),
			content: z.string().optional(), // For inline scripts
			data: z.union([z.record(z.unknown()), z.array(z.unknown()), z.string()]).optional(), // For structured data (JSON-LD)
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
 * Simplified render options for Vite-powered architecture
 */
export const RenderOptionsSchema: z.ZodObject<{
	title: z.ZodOptional<z.ZodString>;
	scripts: z.ZodOptional<z.ZodArray<typeof ScriptConfigSchema, 'many'>>;
	styles: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
	meta: z.ZodOptional<z.ZodArray<typeof MetaTagSchema, 'many'>>;
}> = z.object({
	title: z.string().optional(),
	scripts: z.array(ScriptConfigSchema).optional(),
	styles: z.array(z.string().min(1)).optional(),
	meta: z.array(MetaTagSchema).optional(),
});


// === Simplified TypeScript types ===

export type MetaTag = z.infer<typeof MetaTagSchema>;
export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;
