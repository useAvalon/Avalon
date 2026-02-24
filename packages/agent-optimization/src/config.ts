import { z } from 'zod';

export const SitemapConfigSchema = z.object({
  siteUrl: z.string().url(),
  siteName: z.string().optional(),
  changefreq: z
    .enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
    .optional()
    .default('weekly'),
  priority: z.number().min(0).max(1).optional().default(0.5),
  dynamicPaths: z.record(z.string(), z.array(z.string())).optional(),
  /** Glob patterns or path prefixes to exclude from the sitemap (e.g. ['/admin/**', '/login']) */
  exclude: z.array(z.string()).optional(),
});

export const AgentOptimizationConfigSchema = z.object({
  sitemap: z.union([z.boolean(), SitemapConfigSchema]).optional(),
  markdown: z.boolean().optional(),
  structuredData: z.boolean().optional(),
});

export type SitemapConfig = z.infer<typeof SitemapConfigSchema>;
export type AgentOptimizationConfig = z.infer<typeof AgentOptimizationConfigSchema>;
export type AgentOptimizationConfigInput = z.input<typeof AgentOptimizationConfigSchema>;

/**
 * Validates the given config object against the AgentOptimizationConfigSchema.
 * Returns the parsed (with defaults applied) config on success, or throws
 * a descriptive error on failure.
 */
export function validateConfig(config: unknown): AgentOptimizationConfig {
  const result = AgentOptimizationConfigSchema.safeParse(config);

  if (result.success) {
    return result.data;
  }

  const messages = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
  );

  throw new Error(
    `Invalid agent-optimization config:\n${messages.join('\n')}`
  );
}
