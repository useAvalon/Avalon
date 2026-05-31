import { z } from "zod";

/**
 * Schema for meta tags
 */
export const MetaTagSchema = z.object({
	name: z.string().min(1),
	content: z.string(),
});

/**
 * Script configuration schema - supports both simple URLs and complex script objects
 */
export const ScriptConfigSchema = z.union([
	// Simple string URL (backward compatible)
	z.string().min(1),
	// Complex script object with attributes
	z
		.object({
			src: z.string().min(1).optional(),
			content: z.string().optional(), // For inline scripts
			data: z
				.union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.string()])
				.optional(), // For structured data (JSON-LD)
			type: z.string().optional(),
			async: z.boolean().optional(),
			defer: z.boolean().optional(),
			crossorigin: z.enum(["anonymous", "use-credentials"]).optional(),
			integrity: z.string().optional(),
			nomodule: z.boolean().optional(),
			referrerpolicy: z
				.enum([
					"no-referrer",
					"no-referrer-when-downgrade",
					"origin",
					"origin-when-cross-origin",
					"same-origin",
					"strict-origin",
					"strict-origin-when-cross-origin",
					"unsafe-url",
				])
				.optional(),
			// Allow custom attributes
			attributes: z.record(z.string(), z.string()).optional(),
		})
		.refine((data) => data.src || data.content || data.data, {
			message: "Script must have either 'src', 'content', or 'data'",
		}),
]);

/**
 * Simplified render options for Vite-powered architecture
 */
export const RenderOptionsSchema = z.object({
	title: z.string().optional(),
	scripts: z.array(ScriptConfigSchema).optional(),
	styles: z.array(z.string().min(1)).optional(),
	meta: z.array(MetaTagSchema).optional(),
});

// === Simplified TypeScript types ===

export type MetaTag = z.infer<typeof MetaTagSchema>;
export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;
