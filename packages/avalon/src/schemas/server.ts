import { z } from 'zod';
import { RenderOptionsSchema } from './core';
import { FileSystemRouterConfigSchema } from './routing';

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

// === Internal Schemas (Building Blocks) ===

/**
 * JSX element type for route components
 */
type JSXElementType =
	| {
			type: string | ((...args: unknown[]) => unknown);
			props: Record<string, unknown> | null;
			key?: string | number | null;
			_owner?: unknown;
			_store?: unknown;
	  }
	| string
	| number
	| boolean
	| null
	| undefined
	| JSXElementType[];

/**
 * Internal JSX schema - used only for building other schemas
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JSXElementSchema: z.ZodType<any> = z.lazy(() =>
	z.union([
		z.object({
			type: z.union([z.string(), z.function()]),
			props: z.record(z.string(), z.unknown()).nullable(),
			key: z.union([z.string(), z.number()]).nullable().optional(),
			_owner: z.unknown().optional(),
			_store: z.unknown().optional(),
		}),
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.undefined(),
		z.array(JSXElementSchema),
	])
);

/**
 * Internal route component schema
 */
const RouteComponentSchema = z.function();

/**
 * Internal route config schema
 */
const RouteConfigSchema = z.object({
	component: RouteComponentSchema,
	options: RenderOptionsSchema.optional(),
});

/**
 * Internal routes schema
 */
const RoutesSchema = z.record(
	z.string(),
	RouteConfigSchema
).refine(
	(routes) => Object.keys(routes).every((k) => k.startsWith('/')),
	{ message: "Route paths must start with '/'" }
);

// === Public Schema (Only One Actually Used) ===

/**
 * Server configuration schema - the only schema actually used for validation
 */
export const ServerConfigSchema = z.object({
	routes: RoutesSchema,
	port: z
		.number()
		.int('Port must be an integer')
		.min(1, 'Port must be at least 1')
		.max(65535, 'Port must be at most 65535')
		.default(8001),
	defaultOptions: RenderOptionsSchema.optional().default({}),
	renderOptions: ComponentRenderOptionsSchema,
	streaming: StreamingConfigSchema,
	fileSystemRouting: FileSystemRouterConfigSchema.optional(),
});

// === Public Types ===

/**
 * Route component function type
 */
export type RouteComponent = () => JSXElementType;

/**
 * Route configuration type — component signature matches ssr.ts RouteConfig
 * to avoid type incompatibility when passing routes to renderToHtml/renderToHtmlWithLayouts.
 */
export type RouteConfig = {
	component: () => JSX.Element | Promise<JSX.Element>;
	options?: z.infer<typeof RenderOptionsSchema>;
};

/**
 * Routes record type
 */
export type Routes = Record<string, RouteConfig>;

/**
 * Server configuration type
 */
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Streaming configuration type
 */
export type StreamingConfig = z.infer<typeof StreamingConfigSchema>;

// === Validation Functions (Used by Server) ===

/**
 * Validates server config - used internally by createServer()
 */
export function validateServerConfig(data: unknown): ServerConfig {
	return ServerConfigSchema.parse(data);
}

/**
 * Safe server config validation - used internally by createServerSafe()
 */
export function safeValidateServerConfig(data: unknown): z.ZodSafeParseResult<ServerConfig> {
	return ServerConfigSchema.safeParse(data);
}
