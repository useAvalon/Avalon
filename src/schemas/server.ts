import { z } from 'zod';
import { ImportMapSchema, PartialRenderOptionsSchema } from './core.ts';

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
const JSXElementSchema: z.ZodType<JSXElementType> = z.lazy(() =>
	z.union([
		z.object({
			type: z.union([z.string(), z.function()]),
			props: z.record(z.unknown()).nullable(),
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
const RouteComponentSchema: z.ZodSchema = z.function().args().returns(z.any());

/**
 * Internal route config schema
 */
const RouteConfigSchema: z.ZodSchema = z.object({
	component: RouteComponentSchema,
	options: PartialRenderOptionsSchema.optional(),
});

/**
 * Internal routes schema
 */
const RoutesSchema: z.ZodSchema = z.record(
	z.string().regex(/^\/.*/, "Route paths must start with '/'"),
	RouteConfigSchema
);

// === Public Schema (Only One Actually Used) ===

/**
 * Server configuration schema - the only schema actually used for validation
 */
export const ServerConfigSchema: z.ZodSchema = z.object({
	routes: RoutesSchema,
	port: z
		.number()
		.int('Port must be an integer')
		.min(1, 'Port must be at least 1')
		.max(65535, 'Port must be at most 65535')
		.default(8001),
	defaultOptions: PartialRenderOptionsSchema.optional().default({}),
	importMap: ImportMapSchema.optional(),
});

// === Public Types ===

/**
 * Route component function type
 */
export type RouteComponent = () => JSXElementType;

/**
 * Route configuration type
 */
export type RouteConfig = z.infer<typeof RouteConfigSchema>;

/**
 * Routes record type
 */
export type Routes = z.infer<typeof RoutesSchema>;

/**
 * Server configuration type
 */
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

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
export function safeValidateServerConfig(data: unknown): z.SafeParseReturnType<unknown, ServerConfig> {
	return ServerConfigSchema.safeParse(data);
}
