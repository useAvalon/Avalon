# Metadata Management in File-System Routing

This guide covers best practices for managing metadata in Avalon's file-system routing system, including SEO optimization, social media integration, and structured data.

## Overview

Avalon's file-system routing provides a hierarchical metadata system that allows you to define metadata at multiple levels:

1. **Global metadata** - Site-wide defaults
2. **Section metadata** - Shared across route sections
3. **Page metadata** - Specific to individual pages
4. **Dynamic metadata** - Generated based on route parameters

## Metadata Hierarchy

Metadata is resolved and merged in the following order (most specific wins):

```
Page-specific metadata (generateMetadata)
    ↓ (merges with)
Section metadata (_metadata.ts)
    ↓ (merges with)
Global metadata (_metadata.ts)
```

## Basic Metadata Structure

### Global Metadata

Create site-wide defaults in your root `_metadata.ts`:

```tsx
// src/pages/_metadata.ts
import { Metadata } from '@avalon/types';

export const metadata: Metadata = {
	// Basic SEO
	title: 'My Avalon App',
	description: 'A modern web application built with Avalon',
	keywords: ['avalon', 'web', 'framework', 'typescript'],
	author: 'Your Name',

	// Viewport and mobile
	viewport: 'width=device-width, initial-scale=1',

	// Search engine directives
	robots: 'index, follow',

	// Canonical URL (can be overridden per page)
	canonical: 'https://myapp.com',

	// Open Graph (Facebook, LinkedIn, etc.)
	openGraph: {
		title: 'My Avalon App',
		description: 'A modern web application built with Avalon',
		type: 'website',
		url: 'https://myapp.com',
		siteName: 'My Avalon App',
		locale: 'en_US',
		images: [
			{
				url: 'https://myapp.com/og-image.jpg',
				width: 1200,
				height: 630,
				alt: 'My Avalon App',
			},
		],
	},

	// Twitter Card
	twitter: {
		card: 'summary_large_image',
		site: '@myapp',
		creator: '@yourhandle',
		title: 'My Avalon App',
		description: 'A modern web application built with Avalon',
		image: 'https://myapp.com/twitter-image.jpg',
	},

	// Structured Data (Schema.org)
	schema: [
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'My Avalon App',
			description: 'A modern web application built with Avalon',
			url: 'https://myapp.com',
			potentialAction: {
				'@type': 'SearchAction',
				target: 'https://myapp.com/search?q={search_term_string}',
				'query-input': 'required name=search_term_string',
			},
		},
	],
};
```

### Section Metadata

Override defaults for specific sections:

```tsx
// src/pages/blog/_metadata.ts
export const metadata: Metadata = {
	title: 'Blog | My Avalon App',
	description: 'Latest articles about web development and technology',
	keywords: ['blog', 'articles', 'web development', 'technology'],

	openGraph: {
		title: 'Blog | My Avalon App',
		description: 'Latest articles about web development and technology',
		type: 'website',
		siteName: 'My Avalon App Blog',
	},

	twitter: {
		card: 'summary',
		title: 'Blog | My Avalon App',
		description: 'Latest articles about web development and technology',
	},

	schema: [
		{
			'@context': 'https://schema.org',
			'@type': 'Blog',
			name: 'My Avalon App Blog',
			description: 'Latest articles about web development and technology',
			url: 'https://myapp.com/blog',
		},
	],
};
```

### Dynamic Metadata

Generate metadata based on route parameters:

```tsx
// src/pages/blog/[slug].tsx
import { Metadata, RouteParams } from '@avalon/types';

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
	// Fetch data based on route parameters
	const post = await getBlogPost(params.slug);

	if (!post) {
		return {
			title: 'Post Not Found | My Blog',
			description: 'The requested blog post could not be found',
			robots: 'noindex, nofollow',
		};
	}

	return {
		title: `${post.title} | My Blog`,
		description: post.excerpt,
		keywords: post.tags,
		author: post.author,

		// Canonical URL for this specific post
		canonical: `https://myapp.com/blog/${post.slug}`,

		// Open Graph for social sharing
		openGraph: {
			title: post.title,
			description: post.excerpt,
			type: 'article',
			url: `https://myapp.com/blog/${post.slug}`,
			publishedTime: post.publishedAt,
			modifiedTime: post.updatedAt,
			author: post.author,
			section: post.category,
			tags: post.tags,
			images: [
				{
					url: post.coverImage,
					width: 1200,
					height: 630,
					alt: post.title,
				},
			],
		},

		// Twitter Card
		twitter: {
			card: 'summary_large_image',
			title: post.title,
			description: post.excerpt,
			image: post.coverImage,
		},

		// Structured Data for articles
		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'BlogPosting',
				headline: post.title,
				description: post.excerpt,
				image: post.coverImage,
				author: {
					'@type': 'Person',
					name: post.author,
				},
				publisher: {
					'@type': 'Organization',
					name: 'My Avalon App',
					logo: {
						'@type': 'ImageObject',
						url: 'https://myapp.com/logo.png',
					},
				},
				datePublished: post.publishedAt,
				dateModified: post.updatedAt,
				mainEntityOfPage: {
					'@type': 'WebPage',
					'@id': `https://myapp.com/blog/${post.slug}`,
				},
				keywords: post.tags.join(', '),
			},
		],
	};
}
```

## Best Practices

### 1. SEO Optimization

**Title Tags:**

- Keep titles under 60 characters
- Include primary keywords
- Make them descriptive and unique
- Use consistent branding

```tsx
// ✅ Good title
title: 'Complete Guide to File-System Routing | My Blog';

// ❌ Too long
title: 'The Complete and Comprehensive Guide to Understanding File-System Routing in Modern Web Applications';

// ❌ Too generic
title: 'Blog Post';
```

**Meta Descriptions:**

- Keep under 160 characters
- Include a call-to-action
- Summarize the page content
- Include relevant keywords naturally

```tsx
// ✅ Good description
description: 'Learn how to implement file-system routing in your web app. Complete guide with examples and best practices.';

// ❌ Too long
description: 'This is a very long description that goes on and on about file-system routing and covers way too many topics in a single sentence that will be truncated by search engines.';
```

**Keywords:**

- Use relevant, specific keywords
- Don't keyword stuff
- Include long-tail keywords
- Consider user intent

```tsx
// ✅ Good keywords
keywords: ['file-system routing', 'web development', 'avalon framework', 'typescript routing'];

// ❌ Keyword stuffing
keywords: ['routing', 'route', 'router', 'routes', 'routing system', 'route system'];
```

### 2. Social Media Optimization

**Open Graph:**

- Always include title, description, and image
- Use high-quality images (1200x630 for Facebook)
- Set appropriate content type
- Include URL and site name

```tsx
openGraph: {
  title: 'Specific Page Title', // Don't include site name
  description: 'Compelling description for social sharing',
  type: 'article', // or 'website' for general pages
  url: 'https://myapp.com/specific-page',
  siteName: 'My App Name',
  images: [
    {
      url: 'https://myapp.com/images/og-specific.jpg',
      width: 1200,
      height: 630,
      alt: 'Descriptive alt text',
    },
  ],
}
```

**Twitter Cards:**

- Choose appropriate card type
- Optimize images for Twitter (1200x600)
- Keep descriptions concise
- Include Twitter handles when relevant

```tsx
twitter: {
  card: 'summary_large_image', // or 'summary' for smaller images
  site: '@myapp', // Your app's Twitter handle
  creator: '@author', // Content creator's handle
  title: 'Page Title',
  description: 'Concise description for Twitter',
  image: 'https://myapp.com/images/twitter-card.jpg',
}
```

### 3. Structured Data

**Common Schema Types:**

```tsx
// Website
{
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Site Name',
  url: 'https://myapp.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://myapp.com/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

// Article/Blog Post
{
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'Article Title',
  image: 'https://myapp.com/article-image.jpg',
  author: {
    '@type': 'Person',
    name: 'Author Name',
  },
  datePublished: '2024-01-01',
  dateModified: '2024-01-02',
}

// Product (for e-commerce)
{
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Product Name',
  image: 'https://myapp.com/product-image.jpg',
  description: 'Product description',
  offers: {
    '@type': 'Offer',
    price: '29.99',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
}

// Organization
{
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Company Name',
  url: 'https://myapp.com',
  logo: 'https://myapp.com/logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-555-123-4567',
    contactType: 'customer service',
  },
}
```

### 4. Performance Considerations

**Lazy Loading Metadata:**
For dynamic metadata that requires API calls, consider caching:

```tsx
// Cache metadata to avoid repeated API calls
const metadataCache = new Map();

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
	const cacheKey = `post-${params.slug}`;

	if (metadataCache.has(cacheKey)) {
		return metadataCache.get(cacheKey);
	}

	const post = await getBlogPost(params.slug);
	const metadata = {
		title: `${post.title} | My Blog`,
		description: post.excerpt,
		// ... rest of metadata
	};

	metadataCache.set(cacheKey, metadata);
	return metadata;
}
```

**Image Optimization:**

- Use appropriate image sizes for different platforms
- Implement responsive images
- Consider WebP format for better compression
- Use CDN for faster loading

### 5. Testing Metadata

**Tools for Testing:**

- Facebook Sharing Debugger
- Twitter Card Validator
- Google Rich Results Test
- LinkedIn Post Inspector

**Automated Testing:**

```tsx
// Test metadata generation
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts';

Deno.test('generates correct metadata for blog post', async () => {
	const metadata = await generateMetadata({ params: { slug: 'test-post' } });

	assertEquals(metadata.title, 'Test Post | My Blog');
	assertEquals(metadata.openGraph?.type, 'article');
	assertEquals(metadata.schema?.[0]['@type'], 'BlogPosting');
});
```

## Common Patterns

### 1. Multi-language Metadata

```tsx
// src/pages/_metadata.ts
const getLocalizedMetadata = (locale: string): Metadata => {
	const translations = {
		en: {
			title: 'My App',
			description: 'A modern web application',
		},
		es: {
			title: 'Mi Aplicación',
			description: 'Una aplicación web moderna',
		},
	};

	const t = translations[locale] || translations.en;

	return {
		title: t.title,
		description: t.description,
		openGraph: {
			locale: locale === 'es' ? 'es_ES' : 'en_US',
			// ... other localized fields
		},
	};
};

export const metadata = getLocalizedMetadata('en');
```

### 2. E-commerce Product Pages

```tsx
// src/pages/products/[id].tsx
export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
	const product = await getProduct(params.id);

	return {
		title: `${product.name} - ${product.price} | My Store`,
		description: product.description,

		openGraph: {
			title: product.name,
			description: product.description,
			type: 'product',
			images: product.images.map(img => ({
				url: img.url,
				width: img.width,
				height: img.height,
				alt: product.name,
			})),
		},

		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'Product',
				name: product.name,
				description: product.description,
				image: product.images.map(img => img.url),
				offers: {
					'@type': 'Offer',
					price: product.price,
					priceCurrency: product.currency,
					availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
				},
				brand: {
					'@type': 'Brand',
					name: product.brand,
				},
				review: product.reviews.map(review => ({
					'@type': 'Review',
					reviewRating: {
						'@type': 'Rating',
						ratingValue: review.rating,
					},
					author: {
						'@type': 'Person',
						name: review.author,
					},
				})),
			},
		],
	};
}
```

### 3. Event Pages

```tsx
// src/pages/events/[id].tsx
export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
	const event = await getEvent(params.id);

	return {
		title: `${event.name} | Events`,
		description: event.description,

		schema: [
			{
				'@context': 'https://schema.org',
				'@type': 'Event',
				name: event.name,
				description: event.description,
				startDate: event.startDate,
				endDate: event.endDate,
				location: {
					'@type': 'Place',
					name: event.venue,
					address: event.address,
				},
				offers: {
					'@type': 'Offer',
					price: event.ticketPrice,
					priceCurrency: 'USD',
					availability: 'https://schema.org/InStock',
				},
			},
		],
	};
}
```

## Troubleshooting

### Common Issues

1. **Metadata not appearing in HTML**

   - Check file naming (`_metadata.ts`)
   - Verify export format (`export const metadata`)
   - Ensure metadata resolver is working

2. **Social sharing not working**

   - Validate Open Graph tags
   - Check image URLs are accessible
   - Test with platform-specific validators

3. **Search engines not indexing**

   - Verify robots meta tag
   - Check canonical URLs
   - Ensure structured data is valid

4. **Performance issues**
   - Cache expensive metadata generation
   - Optimize image sizes
   - Consider static generation for dynamic content

This comprehensive guide should help you implement effective metadata management in your Avalon file-system routing applications.
