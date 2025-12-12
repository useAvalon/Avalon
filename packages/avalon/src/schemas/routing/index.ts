// Re-export all routing schemas and types
export * from '../routing.ts';

// Export specific validators for routing
import {
	FileSystemRouteSchema,
	RoutePageModuleSchema,
	RouteDiscoveryOptionsSchema,
	FileSystemRouterConfigSchema,
	MetadataSchema,
	ResolvedMetadataSchema,
} from '../routing.ts';

import { validate, safeValidate } from '../index.ts';

// Routing-specific validators
export const routingValidators = {
	fileSystemRoute: (data: unknown) => validate(FileSystemRouteSchema, data, 'Invalid file system route'),
	routePageModule: (data: unknown) => validate(RoutePageModuleSchema, data, 'Invalid route page module'),
	routeDiscoveryOptions: (data: unknown) =>
		validate(RouteDiscoveryOptionsSchema, data, 'Invalid route discovery options'),
	fileSystemRouterConfig: (data: unknown) =>
		validate(FileSystemRouterConfigSchema, data, 'Invalid file system router config'),
	metadata: (data: unknown) => validate(MetadataSchema, data, 'Invalid metadata'),
	resolvedMetadata: (data: unknown) => validate(ResolvedMetadataSchema, data, 'Invalid resolved metadata'),
} as const;

// Safe routing validators
export const safeRoutingValidators = {
	fileSystemRoute: (data: unknown) => safeValidate(FileSystemRouteSchema, data, 'Invalid file system route'),
	routePageModule: (data: unknown) => safeValidate(RoutePageModuleSchema, data, 'Invalid route page module'),
	routeDiscoveryOptions: (data: unknown) =>
		safeValidate(RouteDiscoveryOptionsSchema, data, 'Invalid route discovery options'),
	fileSystemRouterConfig: (data: unknown) =>
		safeValidate(FileSystemRouterConfigSchema, data, 'Invalid file system router config'),
	metadata: (data: unknown) => safeValidate(MetadataSchema, data, 'Invalid metadata'),
	resolvedMetadata: (data: unknown) => safeValidate(ResolvedMetadataSchema, data, 'Invalid resolved metadata'),
} as const;
