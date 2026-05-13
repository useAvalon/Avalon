import { z } from 'zod';

// ---------------------------------------------------------------------------
// Author / Person schema config
// ---------------------------------------------------------------------------

export const PersonConfigSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  image: z.string().optional(),
  jobTitle: z.string().optional(),
  worksFor: z.object({
    name: z.string(),
    url: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  sameAs: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Publisher / Organization schema config
// ---------------------------------------------------------------------------

export const OrganizationConfigSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  logo: z.object({
    url: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// SEO Plugin Config
// ---------------------------------------------------------------------------

export const SeoConfigSchema = z.object({
  /** Base site URL (e.g., "https://example.com") */
  siteUrl: z.string(),
  /** Site name used in OG tags and JSON-LD */
  siteName: z.string(),
  /** Default meta description fallback */
  defaultDescription: z.string().optional(),
  /** Default OG image when pages don't specify one */
  defaultOgImage: z.object({
    url: z.string(),
    width: z.number().optional().default(1200),
    height: z.number().optional().default(630),
  }).optional(),
  /** Twitter/X handle for twitter:site (e.g., "@mysite") */
  twitterSite: z.string().optional(),
  /** Twitter/X handle for twitter:creator */
  twitterCreator: z.string().optional(),
  /** Default OG locale */
  locale: z.string().optional().default('en_US'),
  /** Author info for Article JSON-LD */
  author: PersonConfigSchema.optional(),
  /** Publisher info for Article JSON-LD */
  publisher: OrganizationConfigSchema.optional(),
  /** Path to the search page (enables WebSite SearchAction JSON-LD) */
  searchPath: z.string().optional(),
  /** Query parameter name for search (default: "q") */
  searchQueryParam: z.string().optional().default('q'),
  /** Enable canonical URL injection (default: true) */
  canonical: z.boolean().optional().default(true),
  /** Enable Open Graph meta injection (default: true) */
  openGraph: z.boolean().optional().default(true),
  /** Enable Twitter card meta injection (default: true) */
  twitterCards: z.boolean().optional().default(true),
  /** Enable JSON-LD structured data injection (default: true) */
  structuredData: z.boolean().optional().default(true),
  /** Enable BreadcrumbList JSON-LD (default: true) */
  breadcrumbs: z.boolean().optional().default(true),
  /** Enable Speakable JSON-LD on articles (default: true) */
  speakable: z.boolean().optional().default(true),
  /** CSS selectors for speakable content */
  speakableSelectors: z.array(z.string()).optional().default(['h1', '[data-speakable]']),
  /** Font preconnect URLs to inject into <head> */
  fontPreconnect: z.array(z.string()).optional(),
  /** Suffix to append to page titles (e.g., " — My Site"). Set to false to disable. */
  titleSuffix: z.union([z.string(), z.literal(false)]).optional(),
});

export type PersonConfig = z.infer<typeof PersonConfigSchema>;
export type OrganizationConfig = z.infer<typeof OrganizationConfigSchema>;
export type SeoConfig = z.infer<typeof SeoConfigSchema>;
export type SeoConfigInput = z.input<typeof SeoConfigSchema>;

/**
 * Validates the given config object against the SeoConfigSchema.
 * Returns the parsed (with defaults applied) config on success, or throws
 * a descriptive error on failure.
 */
export function validateSeoConfig(config: unknown): SeoConfig {
  const result = SeoConfigSchema.safeParse(config);

  if (result.success) {
    return result.data;
  }

  const messages = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
  );

  throw new Error(
    `Invalid @useavalon/seo config:\n${messages.join('\n')}`
  );
}
