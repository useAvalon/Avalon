import { assertEquals, assertExists, assert } from 'jsr:@std/assert';
import { join, resolve } from 'node:path';
import { existsSync } from '@std/fs';
import { LayoutComposer } from '../layout-composer.ts';
import type { LayoutConfig, LayoutHandler, LayoutDiscoveryOptions } from '../../../schemas/layout.ts';

// Test fixtures directory
const TEST_FIXTURES_DIR = resolve('tests/fixtures/layout-composer');
const TEST_PAGES_DIR = join(TEST_FIXTURES_DIR, 'src/pages');
const TEST_LAYOUTS_DIR = join(TEST_FIXTURES_DIR, 'src/layouts');

// Mock page module interface
interface MockPageModule {
	default: any;
	layoutConfig?: LayoutConfig;
}

// Helper function to create test layout files
async function createTestLayouts() {
	// Root layout
	const rootLayoutContent = `
export default function RootLayout({ children, data }) {
	return (
		<html>
			<body>
				<header>Root Header</header>
				{children}
				<footer>Root Footer</footer>
			</body>
		</html>
	);
}

export async function layoutLoader(ctx) {
	return { title: 'Root Layout' };
}
`;

	// Blog layout
	const blogLayoutContent = `
export default function BlogLayout({ children, data }) {
	return (
		<div className="blog-layout">
			<nav>Blog Navigation</nav>
			<main>{children}</main>
		</div>
	);
}

export async function layoutLoader(ctx) {
	return { blogTitle: 'My Blog' };
}
`;

	// Custom layout
	const customLayoutContent = `
export default function CustomLayout({ children, data }) {
	return (
		<div className="custom-layout">
			<h1>Custom Layout</h1>
			{children}
		</div>
	);
}

export async function layoutLoader(ctx) {
	return { customData: 'Custom Layout Data' };
}
`;

	// Write layout files
	Deno.writeTextFileSync(join(TEST_PAGES_DIR, '_layout.tsx'), rootLayoutContent);

	Deno.mkdirSync(join(TEST_PAGES_DIR, 'blog'), { recursive: true });
	Deno.writeTextFileSync(join(TEST_PAGES_DIR, 'blog', '_layout.tsx'), blogLayoutContent);

	Deno.writeTextFileSync(join(TEST_LAYOUTS_DIR, 'custom.tsx'), customLayoutContent);
}

async function setupTestFixtures(): Promise<LayoutComposer> {
	// Create test directory structure
	if (existsSync(TEST_FIXTURES_DIR)) {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true });
	}
	await Deno.mkdir(TEST_FIXTURES_DIR, { recursive: true });
	await Deno.mkdir(TEST_PAGES_DIR, { recursive: true });
	await Deno.mkdir(TEST_LAYOUTS_DIR, { recursive: true });

	// Create test layout files
	await createTestLayouts();

	// Initialize composer
	const options: LayoutDiscoveryOptions = {
		baseDirectory: join(TEST_FIXTURES_DIR, 'src'),
		filePattern: '_layout.tsx',
		excludeDirectories: ['node_modules', '.git'],
		enableWatching: false,
		developmentMode: true,
	};

	return new LayoutComposer(options);
}

function cleanupTestFixtures() {
	// Clean up test fixtures
	if (existsSync(TEST_FIXTURES_DIR)) {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true });
	}
}

Deno.test('LayoutComposer - Basic Layout Resolution', async () => {
	const composer = await setupTestFixtures();

	try {
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assertExists(layouts);
		assert(Array.isArray(layouts));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - replaceLayout Configuration', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.1: replaceLayout should skip all parent layouts
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				replaceLayout: true,
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assertEquals(layouts.length, 0);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - replaceLayout with customLayout', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.1: replaceLayout with customLayout should use only the custom layout
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				replaceLayout: true,
				customLayout: customLayoutPath,
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assertEquals(layouts.length, 1);
		assertEquals(layouts[0].path, customLayoutPath);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - skipLayouts Configuration', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.2: skipLayouts should exclude specified layouts
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				skipLayouts: ['_layout.tsx'],
			},
		};

		const allLayouts = await composer.resolveLayouts('/blog/post', { default: () => 'Page' });
		const filteredLayouts = await composer.resolveLayouts('/blog/post', pageModule);

		assert(filteredLayouts.length <= allLayouts.length);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - skipLayouts with pattern matching', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.2: skipLayouts should support pattern matching
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				skipLayouts: ['*blog*'],
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		// Should skip any layouts with 'blog' in the path
		const blogLayouts = layouts.filter(layout => layout.path.includes('blog'));
		assertEquals(blogLayouts.length, 0);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - onlyLayouts Configuration', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.3: onlyLayouts should only apply specified layouts
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				onlyLayouts: ['_layout.tsx'],
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		// Should only contain layouts matching the pattern
		assert(layouts.every(layout => layout.path.includes('_layout.tsx')));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - onlyLayouts with custom layouts', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.3: onlyLayouts should support custom layout paths
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				onlyLayouts: [customLayoutPath],
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assert(layouts.some(layout => layout.path === customLayoutPath));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - customLayout Configuration', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.4: customLayout should add specified layout file
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				customLayout: customLayoutPath,
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assert(layouts.some(layout => layout.path === customLayoutPath));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - customLayout with relative paths', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.4: customLayout should support relative paths
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				customLayout: 'src/layouts/custom.tsx',
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		assert(layouts.some(layout => layout.path.includes('custom.tsx')));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Configuration Validation - Valid Config', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.5: Configuration validation should work correctly
		const validConfig: LayoutConfig = {
			skipLayouts: ['layout1.tsx'],
			customLayout: 'custom.tsx',
		};

		const result = composer.validateLayoutConfig(validConfig);

		assertEquals(result.valid, true);
		assertEquals(result.errors.length, 0);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Configuration Validation - Conflicting replaceLayout and onlyLayouts', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.5: Should detect configuration conflicts
		const invalidConfig: LayoutConfig = {
			replaceLayout: true,
			onlyLayouts: ['layout1.tsx'],
		};

		const result = composer.validateLayoutConfig(invalidConfig);

		assertEquals(result.valid, false);
		assert(result.errors.includes('replaceLayout and onlyLayouts cannot be used together'));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Configuration Validation - Conflicting replaceLayout and skipLayouts', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.5: Should detect configuration conflicts
		const invalidConfig: LayoutConfig = {
			replaceLayout: true,
			skipLayouts: ['layout1.tsx'],
		};

		const result = composer.validateLayoutConfig(invalidConfig);

		assertEquals(result.valid, false);
		assert(result.errors.includes('replaceLayout and skipLayouts cannot be used together'));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Configuration Validation - Array Types', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.5: Should validate configuration types
		const invalidConfig: any = {
			skipLayouts: 'not-an-array',
			onlyLayouts: 123,
		};

		const result = composer.validateLayoutConfig(invalidConfig);

		assertEquals(result.valid, false);
		assert(result.errors.includes('skipLayouts must be an array of strings'));
		assert(result.errors.includes('onlyLayouts must be an array of strings'));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Configuration Validation - customLayout Type', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.5: Should validate customLayout type
		const invalidConfig: any = {
			customLayout: 123,
		};

		const result = composer.validateLayoutConfig(invalidConfig);

		assertEquals(result.valid, false);
		assert(result.errors.includes('customLayout must be a string path'));
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Complex Configuration - skipLayouts with customLayout', async () => {
	const composer = await setupTestFixtures();

	try {
		// Requirement 5.2, 5.4: Should work together
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				skipLayouts: ['*blog*'],
				customLayout: customLayoutPath,
			},
		};

		const layouts = await composer.resolveLayouts('/blog/post', pageModule);

		// Should skip blog layouts but include custom layout
		assert(layouts.some(layout => layout.path === customLayoutPath));
		assertEquals(layouts.filter(layout => layout.path.includes('blog')).length, 0);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Cache Management', async () => {
	const composer = await setupTestFixtures();

	try {
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				customLayout: customLayoutPath,
			},
		};

		// First call
		await composer.resolveLayouts('/blog/post', pageModule);
		const stats1 = composer.getCompositionStats();

		// Second call
		await composer.resolveLayouts('/blog/post', pageModule);
		const stats2 = composer.getCompositionStats();

		assert(stats1.customLayoutCacheSize > 0);
		assertEquals(stats2.customLayoutCacheSize, stats1.customLayoutCacheSize);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Cache Clearing', async () => {
	const composer = await setupTestFixtures();

	try {
		const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				customLayout: customLayoutPath,
			},
		};

		await composer.resolveLayouts('/blog/post', pageModule);

		composer.clearCache();
		const stats = composer.getCompositionStats();

		assertEquals(stats.customLayoutCacheSize, 0);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Development Mode', async () => {
	const composer = await setupTestFixtures();

	try {
		assertEquals(composer.isDevelopmentMode(), true);

		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				replaceLayout: true,
			},
		};

		// Should not throw in development mode
		const layouts = await composer.resolveLayouts('/blog/post', pageModule);
		assertExists(layouts);
	} finally {
		cleanupTestFixtures();
	}
});

Deno.test('LayoutComposer - Error Handling', async () => {
	const composer = await setupTestFixtures();

	try {
		const pageModule: MockPageModule = {
			default: () => 'Page Component',
			layoutConfig: {
				customLayout: '/invalid/path/that/does/not/exist.tsx',
			},
		};

		// Should not throw and should return some layouts
		const layouts = await composer.resolveLayouts('/blog/post', pageModule);
		assertExists(layouts);
		assert(Array.isArray(layouts));
	} finally {
		cleanupTestFixtures();
	}
});
