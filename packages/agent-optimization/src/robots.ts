/** robots.txt with sitemap reference and common AI crawlers allowed. */
export function buildRobotsTxt(siteUrl: string): string {
	const base = siteUrl.replace(/\/+$/, "");
	return `# robots.txt

User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /
`;
}
