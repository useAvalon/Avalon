import { z } from 'zod';
import { ComponentType, ComponentChildren } from 'preact';

/**
 * Layout Context Schema - Contains request information and state for layout processing
 */
export const LayoutContextSchema = z.object({
	request: z.instanceof(Request),
	params: z.record(z.string()),
	query: z.instanceof(URLSearchParams),
	state: z.instanceof(Map),
	middlewareContext: z.any().optional(), // MiddlewareContext type from middleware system
});

/**
 * Layout Data Schema - Flexible data structure for layout loaders
 */
export const LayoutDataSchema = z.record(z.unknown());

/**
 * Layout Route Schema - Represents a discovered layout file with routing information
 */
export const LayoutRouteSchema = z.object({
	pattern: z.instanceof(URLPattern),
	layoutPath: z.string().min(1),
	priority: z.number().int().min(0),
	type: z.enum(['root', 'nested']),
	depth: z.number().int().min(0),
});

/**
 * Layout Handler Schema - Complete layout information including component and loader
 */
export const LayoutHandlerSchema = z.object({
	component: z.any(), // ComponentType<LayoutProps> - can't validate function types with Zod
	loader: z.any().optional(), // LayoutLoader function - can't validate function signature with Zod
	path: z.string().min(1),
	priority: z.number().int().min(0),
});

/**
 * Layout Props Schema - Props passed to layout components
 */
export const LayoutPropsSchema = z.object({
	children: z.any(), // ComponentChildren - can't validate JSX with Zod
	data: LayoutDataSchema,
	frontmatter: z.record(z.any()).optional(), // Frontmatter from MDX files
	route: z.object({
		path: z.string(),
		params: z.record(z.string()),
		query: z.instanceof(URLSearchParams),
	}),
});

/**
 * Layout Discovery Options Schema
 */
export const LayoutDiscoveryOptionsSchema = z.object({
	baseDirectory: z.string().min(1),
	filePattern: z.string().min(1).optional().default('_layout.tsx'),
	excludeDirectories: z.array(z.string()).optional().default([]),
	enableWatching: z.boolean().optional().default(false),
	developmentMode: z.boolean().optional().default(false),
});

/**
 * Route Info Schema - Information about the current route for conditional rendering
 */
export const RouteInfoSchema = z.object({
	path: z.string(),
	params: z.record(z.string()),
	method: z.string(),
	headers: z.instanceof(Headers),
});

/**
 * Layout Rule Schema - Rules for conditional layout rendering
 */
export const LayoutRuleSchema = z.object({
	matches: z.any(), // (layoutPath: string, route: RouteInfo) => boolean - can't validate function signature with Zod
	apply: z.boolean(),
	priority: z.number().int(),
});

/**
 * Layout Config Schema - Page-level layout composition control
 */
export const LayoutConfigSchema = z.object({
	skipLayouts: z.array(z.string()).optional(),
	replaceLayout: z.boolean().optional(),
	onlyLayouts: z.array(z.string()).optional(),
	customLayout: z.string().optional(),
});

/**
 * Island State Schema - State data for persistent islands
 */
export const IslandStateSchema = z.record(z.unknown());

/**
 * Persistent Island Props Schema
 */
export const PersistentIslandPropsSchema = z.object({
	persistentId: z.string().min(1),
	children: z.any(), // ComponentChildren
});

/**
 * Persistent Island Context Schema
 */
export const PersistentIslandContextSchema = z.object({
	saveState: z.any(), // (state: IslandState) => void - can't validate function signature with Zod
	loadState: z.any(), // () => IslandState | null - can't validate function signature with Zod
	clearState: z.any(), // () => void - can't validate function signature with Zod
});

/**
 * Layout Error Info Schema
 */
export const LayoutErrorInfoSchema = z.object({
	layoutPath: z.string(),
	errorType: z.enum(['component', 'loader', 'rendering', 'island']),
	timestamp: z.number().int().positive(),
	componentStack: z.string().optional(),
	errorBoundary: z.string().optional(),
});

/**
 * Layout Error Boundary Props Schema
 */
export const LayoutErrorBoundaryPropsSchema = z.object({
	children: z.any(), // ComponentChildren
	fallback: z.any(), // (error: Error, retry: () => void) => ComponentChildren - can't validate function signature with Zod
	onError: z.any().optional(), // (error: Error, errorInfo: any) => void - can't validate function signature with Zod
});

/**
 * Error Recovery Strategy Schema
 */
export const ErrorRecoveryStrategySchema = z.object({
	type: z.enum(['retry', 'fallback', 'skip', 'redirect']),
	maxRetries: z.number().int().positive().optional(),
	fallbackComponent: z.any().optional(), // ComponentType
	redirectUrl: z.string().url().optional(),
});

/**
 * Streaming Layout Props Schema
 */
export const StreamingLayoutPropsSchema = z.object({
	children: z.any(), // ComponentChildren
	fallback: z.any().optional(), // ComponentChildren
	priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

/**
 * Streaming Component Schema
 */
export const StreamingComponentSchema = z.object({
	component: z.any(), // ComponentType
	fallback: z.any(), // ComponentType
	priority: z.number().int().min(0),
	isReady: z.any(), // () => Promise<boolean> - can't validate function signature with Zod
});

/**
 * Resolved Layout Schema - Complete layout resolution result
 */
export const ResolvedLayoutSchema = z.object({
	handlers: z.array(LayoutHandlerSchema),
	dataLoaders: z.array(z.any()), // LayoutLoader[] - can't validate function signature with Zod
	errorBoundaries: z.array(z.any()), // LayoutErrorBoundary[]
	streamingComponents: z.array(StreamingComponentSchema),
	metadata: z.object({
		totalLayouts: z.number().int().min(0),
		resolutionTime: z.number().positive(),
		cacheHit: z.boolean(),
	}),
});

/**
 * Layout Cache Schema
 */
export const LayoutCacheSchema = z.object({
	resolved: z.instanceof(Map), // Map<string, ResolvedLayout>
	handlers: z.instanceof(Map), // Map<string, LayoutHandler>
	data: z.instanceof(Map), // Map<string, LayoutData>
	ttl: z.instanceof(Map), // Map<string, number>
});

/**
 * Enhanced Layout Context Schema - Extended context with layout-specific information
 */
export const EnhancedLayoutContextSchema = LayoutContextSchema.extend({
	layouts: z.array(LayoutHandlerSchema),
	parentData: z.array(LayoutDataSchema),
	islandStates: z.instanceof(Map), // Map<string, IslandState>
	streamingEnabled: z.boolean(),
	errorBoundaries: z.array(z.any()), // LayoutErrorBoundary[]
});

// === TypeScript Type Definitions ===

export type LayoutContext = z.infer<typeof LayoutContextSchema>;
export type LayoutData = z.infer<typeof LayoutDataSchema>;
export type LayoutRoute = z.infer<typeof LayoutRouteSchema>;
export type LayoutHandler = z.infer<typeof LayoutHandlerSchema>;
export type LayoutProps = z.infer<typeof LayoutPropsSchema>;
export type LayoutDiscoveryOptions = {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
};
export type RouteInfo = z.infer<typeof RouteInfoSchema>;
export type LayoutRule = z.infer<typeof LayoutRuleSchema>;
export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;
export type IslandState = z.infer<typeof IslandStateSchema>;
export type PersistentIslandProps = z.infer<typeof PersistentIslandPropsSchema>;
export type PersistentIslandContext = z.infer<typeof PersistentIslandContextSchema>;
export type LayoutErrorInfo = z.infer<typeof LayoutErrorInfoSchema>;
export type LayoutErrorBoundaryProps = z.infer<typeof LayoutErrorBoundaryPropsSchema>;
export type ErrorRecoveryStrategy = z.infer<typeof ErrorRecoveryStrategySchema>;
export type StreamingLayoutProps = z.infer<typeof StreamingLayoutPropsSchema>;
export type StreamingComponent = z.infer<typeof StreamingComponentSchema>;
export type ResolvedLayout = z.infer<typeof ResolvedLayoutSchema>;
export type LayoutCache = z.infer<typeof LayoutCacheSchema>;
export type EnhancedLayoutContext = z.infer<typeof EnhancedLayoutContextSchema>;

// === Function Type Definitions ===

/**
 * Layout Loader Function Type
 * Loads data for a specific layout component
 */
export type LayoutLoader = (ctx: LayoutContext) => Promise<LayoutData>;

/**
 * Layout Matcher Function Type
 * Determines if a layout should be applied based on route information
 */
export type LayoutMatcherFunction = (layoutPath: string, route: RouteInfo) => boolean;

/**
 * Layout Error Handler Function Type
 * Handles errors that occur during layout processing
 */
export type LayoutErrorHandler = (error: Error, errorInfo: LayoutErrorInfo) => void;

/**
 * Layout Retry Function Type
 * Function to retry failed layout operations
 */
export type LayoutRetryFunction = () => void;

/**
 * Layout Fallback Renderer Function Type
 * Renders fallback UI when layout errors occur
 */
export type LayoutFallbackRenderer = (error: Error, retry: LayoutRetryFunction) => ComponentChildren;

/**
 * Island State Saver Function Type
 * Saves island state to persistence layer
 */
export type IslandStateSaver = (state: IslandState) => void;

/**
 * Island State Loader Function Type
 * Loads island state from persistence layer
 */
export type IslandStateLoader = () => IslandState | null;

/**
 * Island State Clearer Function Type
 * Clears island state from persistence layer
 */
export type IslandStateClearer = () => void;

/**
 * Streaming Component Ready Check Function Type
 * Checks if a streaming component is ready to render
 */
export type StreamingReadyCheck = () => Promise<boolean>;
