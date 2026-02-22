import { z } from 'zod';

// Component render options schema
export const ComponentRenderOptionsSchema = z
	.object({
		forceSSROnly: z.boolean().optional(),
		detectScripts: z.boolean().optional(),
		suppressWarnings: z.boolean().optional(),
		logDecisions: z.boolean().optional(),
	})
	.optional();

/**
 * Streaming configuration schema
 *
 * Controls HTML streaming behavior using Web Streams API (ReadableStream).
 *
 * Note: While Preact 10.x includes native streaming APIs (renderToPipeableStream,
 * renderToReadableStream), Avalon uses a custom Web Streams approach for consistency
 * across all supported frameworks (React, Preact, Vue, Svelte, Solid, Lit).
 *
 * @property {boolean} enabled - Enable/disable streaming (default: true)
 * @property {number} onShellReadyTimeout - Timeout in ms for shell to be ready (default: 5000)
 * @property {number} onAllReadyTimeout - Timeout in ms for all content to be ready (default: 30000)
 *
 * @example
 * ```typescript
 * const config = {
 *   streaming: {
 *     enabled: true,
 *     onShellReadyTimeout: 5000,
 *     onAllReadyTimeout: 30000
 *   }
 * };
 * ```
 *
 * Requirements: 6.2, 10.1
 */
export const StreamingConfigSchema = z
	.object({
		/** Enable or disable HTML streaming (default: true) */
		enabled: z.boolean().default(true),
		/** Timeout in milliseconds for shell to be ready (default: 5000ms) */
		onShellReadyTimeout: z.number().min(0).default(5000),
		/** Timeout in milliseconds for all content to be ready (default: 30000ms) */
		onAllReadyTimeout: z.number().min(0).default(30000),
	})
	.optional()
	.default({ enabled: true, onShellReadyTimeout: 5000, onAllReadyTimeout: 30000 });

/**
 * Streaming configuration type
 */
export type StreamingConfig = z.infer<typeof StreamingConfigSchema>;
