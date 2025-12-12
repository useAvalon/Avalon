import { assertEquals, assertExists, assert } from '@std/assert';
import { join } from '@std/path';
import { MetadataResolver } from '../metadata-resolver.ts';
import type { Metadata, MetadataChain, RouteParams } from '../../../schemas/routing.ts';

Deno.test('MetadataResolver - mergeMetadata - should merge simple metadata properties', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: {
			title: 'Global Title',
			description: 'Global description',
		},
		sections: [
			{
				path: 'blog',
				metadata: {
					title: 'Blog Title',
					keywords: ['blog'],
				},
			},
		],
	};

	const pageMetadata: Metadata = {
		title: 'Page Title',
		canonical: 'https://example.com/page',
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.title, 'Page Title'); // Page takes precedence
	assertEquals(merged.description, 'Global description'); // From global
	assertEquals(merged.keywords, ['blog']); // From section
	assertEquals(merged.canonical, 'https://example.com/page'); // From page
	assertExists(merged.sources);
	assertExists(merged.resolvedAt);
});

Deno.test('MetadataResolver - mergeMetadata - should merge keyword arrays without duplicates', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: {
			keywords: ['global', 'site'],
		},
		sections: [
			{
				path: 'blog',
				metadata: {
					keywords: ['blog', 'site'], // 'site' is duplicate
				},
			},
		],
	};

	const pageMetadata: Metadata = {
		keywords: ['page', 'blog'], // 'blog' is duplicate
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.keywords, ['global', 'site', 'blog', 'page']);
});

Deno.test('MetadataResolver - mergeMetadata - should merge schema arrays', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: {
			schema: [{ '@type': 'Organization', name: 'Global Org' }],
		},
		sections: [
			{
				path: 'blog',
				metadata: {
					schema: [{ '@type': 'Blog', name: 'Blog Schema' }],
				},
			},
		],
	};

	const pageMetadata: Metadata = {
		schema: [{ '@type': 'Article', headline: 'Page Article' }],
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.schema?.length, 3);
	assert(merged.schema?.some(s => s['@type'] === 'Organization'));
	assert(merged.schema?.some(s => s['@type'] === 'Blog'));
	assert(merged.schema?.some(s => s['@type'] === 'Article'));
});

Deno.test('MetadataResolver - mergeMetadata - should deep merge OpenGraph objects', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: {
			openGraph: {
				siteName: 'Global Site',
				type: 'website',
			},
		},
		sections: [
			{
				path: 'blog',
				metadata: {
					openGraph: {
						type: 'article', // Override global type
						title: 'Blog Title',
					},
				},
			},
		],
	};

	const pageMetadata: Metadata = {
		openGraph: {
			title: 'Page Title', // Override section title
			description: 'Page description',
		},
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.openGraph?.siteName, 'Global Site'); // From global
	assertEquals(merged.openGraph?.type, 'article'); // From section (overrides global)
	assertEquals(merged.openGraph?.title, 'Page Title'); // From page (overrides section)
	assertEquals(merged.openGraph?.description, 'Page description'); // From page
});

Deno.test('MetadataResolver - mergeMetadata - should deep merge Twitter Card objects', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: {
			twitter: {
				site: '@globalsite',
				card: 'summary' as const,
			},
		},
		sections: [],
	};

	const pageMetadata: Metadata = {
		twitter: {
			title: 'Page Title',
			description: 'Page description',
		},
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.twitter?.site, '@globalsite'); // From global
	assertEquals(merged.twitter?.card, 'summary'); // From global
	assertEquals(merged.twitter?.title, 'Page Title'); // From page
	assertEquals(merged.twitter?.description, 'Page description'); // From page
});

Deno.test('MetadataResolver - mergeMetadata - should include metadata sources and timestamp', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const chain: MetadataChain = {
		global: { title: 'Global' },
		sections: [
			{
				path: 'blog',
				metadata: { description: 'Blog' },
			},
		],
	};

	const pageMetadata: Metadata = {
		keywords: ['page'],
	};

	const merged = await resolver.mergeMetadata(chain, pageMetadata);

	assertEquals(merged.sources, ['global', 'section:blog', 'page']);
	assertExists(merged.resolvedAt);
	assert(typeof merged.resolvedAt === 'number');
	assert(merged.resolvedAt > 0);
});

Deno.test(
	'MetadataResolver - generateDynamicMetadata - should generate metadata using the provided function',
	async () => {
		const resolver = new MetadataResolver('test/pages', true);

		const params: RouteParams = { slug: 'test-post', category: 'tech' };
		const generateMetadata = async (params: RouteParams): Promise<Metadata> => ({
			title: `Post: ${params.slug}`,
			description: `Category: ${params.category}`,
		});

		const result = await resolver.generateDynamicMetadata(generateMetadata, params);

		assertEquals(result.title, 'Post: test-post');
		assertEquals(result.description, 'Category: tech');
	}
);

Deno.test('MetadataResolver - generateDynamicMetadata - should handle errors in metadata generation', async () => {
	const resolver = new MetadataResolver('test/pages', true);

	const params: RouteParams = { slug: 'test' };
	const generateMetadata = async (_params: RouteParams): Promise<Metadata> => {
		throw new Error('Generation failed');
	};

	const result = await resolver.generateDynamicMetadata(generateMetadata, params);

	assertEquals(result, {});
});

Deno.test('MetadataResolver - cache management - should clear all caches', () => {
	const resolver = new MetadataResolver('test/pages', true);

	resolver.clearCache();

	// Verify caches are cleared by checking internal state
	assertEquals((resolver as any).metadataCache.size, 0);
	assertEquals((resolver as any).chainCache.size, 0);
});

Deno.test('MetadataResolver - private helper methods - should convert route paths to file paths correctly', () => {
	const resolver = new MetadataResolver('test/pages', true);

	// Access private method for testing
	const routePathToFilePath = (resolver as any).routePathToFilePath.bind(resolver);

	assertEquals(routePathToFilePath('/'), join('test/pages', 'index.tsx'));
	assertEquals(routePathToFilePath('/about'), join('test/pages', 'about'));
	assertEquals(routePathToFilePath('/blog/post'), join('test/pages', 'blog/post'));
	assertEquals(routePathToFilePath('blog/post'), join('test/pages', 'blog/post'));
});

Deno.test('MetadataResolver - private helper methods - should build directory hierarchy correctly', () => {
	const resolver = new MetadataResolver('test/pages', true);

	// Access private method for testing
	const getDirectoryHierarchy = (resolver as any).getDirectoryHierarchy.bind(resolver);

	const hierarchy = getDirectoryHierarchy(join('test/pages/blog/admin/users.tsx'));

	assertEquals(hierarchy, ['test/pages', join('test/pages/blog'), join('test/pages/blog/admin')]);
});

Deno.test('createMetadataResolver - should create a resolver with custom configuration', async () => {
	const { createMetadataResolver } = await import('../metadata-resolver.ts');

	const resolver = createMetadataResolver('custom/pages', false);

	assert(resolver instanceof MetadataResolver);
	assertEquals((resolver as any).pagesDirectory, 'custom/pages');
	assertEquals((resolver as any).enableCaching, false);
});

Deno.test('createMetadataResolver - should use default configuration when no parameters provided', async () => {
	const { createMetadataResolver } = await import('../metadata-resolver.ts');

	const resolver = createMetadataResolver();

	assert(resolver instanceof MetadataResolver);
	assertEquals((resolver as any).pagesDirectory, 'src/pages');
	assertEquals((resolver as any).enableCaching, true);
});
