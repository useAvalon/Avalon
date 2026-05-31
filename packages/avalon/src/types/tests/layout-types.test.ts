import { describe, expect, it } from "vitest";
import { safeValidators, validators } from "../../schemas/index.ts";
import {
	LayoutConfigSchema,
	LayoutContextSchema,
	LayoutDataSchema,
	LayoutDiscoveryOptionsSchema,
	LayoutHandlerSchema,
	LayoutPropsSchema,
	LayoutRouteSchema,
	ResolvedLayoutSchema,
} from "../../schemas/layout.ts";
import type {
	LayoutConfig,
	LayoutContext,
	LayoutData,
	LayoutDiscoveryOptions,
	LayoutHandler,
	LayoutProps,
	LayoutRoute,
	ResolvedLayout,
} from "../layout.ts";

describe("Layout System Types and Schemas", () => {
	it("LayoutContext - should validate valid layout context", () => {
		const mockRequest = new Request("https://example.com/test");
		const mockParams = { id: "123" };
		const mockQuery = new URLSearchParams("?page=1");
		const mockState = new Map();

		const validContext: LayoutContext = {
			request: mockRequest,
			params: mockParams,
			query: mockQuery,
			state: mockState,
		};

		const result = safeValidators.layoutContext(validContext);
		expect(result.success).toEqual(true);
	});

	it("LayoutContext - should reject invalid layout context", () => {
		const invalidContext = {
			request: "not-a-request",
			params: "not-an-object",
			query: "not-urlsearchparams",
			state: "not-a-map",
		};

		const result = safeValidators.layoutContext(invalidContext);
		expect(result.success).toEqual(false);
	});

	it("LayoutData - should validate layout data as record", () => {
		const validData: LayoutData = {
			user: { name: "John", id: 123 },
			settings: { theme: "dark" },
			items: [1, 2, 3],
		};

		const result = safeValidators.layoutData(validData);
		expect(result.success).toEqual(true);
	});

	it("LayoutData - should accept empty layout data", () => {
		const emptyData: LayoutData = {};

		const result = safeValidators.layoutData(emptyData);
		expect(result.success).toEqual(true);
	});

	it("LayoutHandler - should validate valid layout handler", () => {
		const validHandler = {
			component: () => null,
			path: "/src/pages/blog/_layout.tsx",
			priority: 10,
		};

		const result = safeValidators.layoutHandler(validHandler);
		expect(result.success).toEqual(true);
	});

	it("LayoutDiscoveryOptions - should validate with defaults", () => {
		const options = {
			baseDirectory: "/src/pages",
		};

		const result = safeValidators.layoutDiscoveryOptions(options);
		expect(result.success).toEqual(true);
		if (result.success) {
			expect(result.data.filePattern).toEqual("_layout.tsx");
			expect(result.data.excludeDirectories).toEqual([]);
			expect(result.data.enableWatching).toEqual(false);
			expect(result.data.developmentMode).toEqual(false);
		}
	});

	it("LayoutDiscoveryOptions - should validate with custom options", () => {
		const options: LayoutDiscoveryOptions = {
			baseDirectory: "/src/pages",
			filePattern: "layout.tsx",
			excludeDirectories: ["node_modules", ".git"],
			enableWatching: true,
			developmentMode: true,
		};

		const result = safeValidators.layoutDiscoveryOptions(options);
		expect(result.success).toEqual(true);
		if (result.success) {
			expect(result.data.filePattern).toEqual("layout.tsx");
			expect(result.data.excludeDirectories).toEqual(["node_modules", ".git"]);
			expect(result.data.enableWatching).toEqual(true);
			expect(result.data.developmentMode).toEqual(true);
		}
	});

	it("LayoutConfig - should validate layout config with all options", () => {
		const config: LayoutConfig = {
			skipLayouts: ["root", "admin"],
			replaceLayout: true,
			onlyLayouts: ["custom"],
			customLayout: "/custom/layout.tsx",
		};

		const result = safeValidators.layoutConfig(config);
		expect(result.success).toEqual(true);
	});

	it("LayoutConfig - should validate empty layout config", () => {
		const config: LayoutConfig = {};

		const result = safeValidators.layoutConfig(config);
		expect(result.success).toEqual(true);
	});

	it("ResolvedLayout - should validate complete resolved layout", () => {
		const resolvedLayout: ResolvedLayout = {
			handlers: [],
			dataLoaders: [],
			errorBoundaries: [],
			streamingComponents: [],
			metadata: {
				totalLayouts: 2,
				resolutionTime: 15.5,
				cacheHit: false,
			},
		};

		const result = safeValidators.resolvedLayout(resolvedLayout);
		expect(result.success).toEqual(true);
	});

	it("ResolvedLayout - should require all metadata fields", () => {
		const incompleteLayout = {
			handlers: [],
			dataLoaders: [],
			errorBoundaries: [],
			streamingComponents: [],
			metadata: {
				totalLayouts: 2,
			},
		};

		const result = safeValidators.resolvedLayout(incompleteLayout);
		expect(result.success).toEqual(false);
	});

	it("Type compatibility - should ensure TypeScript types match Zod schemas", () => {
		const mockRequest = new Request("https://example.com");
		const layoutContext: LayoutContext = {
			request: mockRequest,
			params: { id: "123" },
			query: new URLSearchParams(),
			state: new Map(),
		};

		const validatedContext = validators.layoutContext(layoutContext);
		expect(validatedContext).toBeDefined();
		expect(validatedContext.request).toEqual(mockRequest);
	});

	it("Error handling - should provide meaningful error messages", () => {
		const invalidData = {
			request: null,
			params: null,
			query: null,
			state: null,
		};

		const result = safeValidators.layoutContext(invalidData);
		expect(result.success).toEqual(false);
		if (!result.success) {
			expect(result.error.message).toContain("Invalid layout context");
			expect(result.error.getFormattedErrors().length > 0).toEqual(true);
		}
	});
});
