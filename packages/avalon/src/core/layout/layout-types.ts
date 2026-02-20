/**
 * Shared layout type definitions for the core/layout module.
 *
 * These are pure TypeScript interfaces with NO zod dependency,
 * intentionally kept separate from schemas/layout.ts to avoid
 * importing zod at cold start time.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentType<P = any> = ((props: P) => any) | (new (props: P) => any);

export interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: unknown;
}

export type LayoutData = Record<string, unknown>;

export type LayoutLoader = (ctx: LayoutContext) => Promise<LayoutData>;

export interface LayoutProps {
	children: unknown;
	data: LayoutData;
	frontmatter?: Record<string, unknown>;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

export interface LayoutHandler {
	component: ComponentType<LayoutProps>;
	loader?: LayoutLoader;
	path: string;
	priority: number;
}

export interface LayoutRoute {
	pattern: URLPattern;
	layoutPath: string;
	priority: number;
	type: 'root' | 'nested';
	depth: number;
}

export interface LayoutDiscoveryOptions {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
}

export interface LayoutConfig {
	skipLayouts?: string[];
	replaceLayout?: boolean;
	onlyLayouts?: string[];
	customLayout?: string;
}

export interface RouteInfo {
	path: string;
	params: Record<string, string>;
	method: string;
	headers: Headers;
}

export interface LayoutRule {
	matches: (route: RouteInfo) => boolean;
	apply: boolean;
	priority: number;
}

export interface LayoutErrorInfo {
	layoutPath: string;
	errorType: 'component' | 'loader' | 'rendering' | 'island';
	timestamp: number;
	componentStack?: string;
	errorBoundary?: string;
}

export interface ResolvedLayout {
	handlers: LayoutHandler[];
	dataLoaders: LayoutLoader[];
	errorBoundaries: unknown[];
	streamingComponents: unknown[];
	metadata: {
		totalLayouts: number;
		resolutionTime: number;
		cacheHit: boolean;
	};
}

export interface LayoutCache {
	resolved: Map<string, ResolvedLayout>;
	handlers: Map<string, LayoutHandler>;
	data: Map<string, LayoutData>;
	ttl: Map<string, number>;
}

export interface PageModule {
	default: ComponentType<unknown>;
	layoutConfig?: LayoutConfig;
	loader?: LayoutLoader;
	frontmatter?: Record<string, unknown>;
}
