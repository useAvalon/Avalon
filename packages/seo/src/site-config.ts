import type { SeoConfigInput } from "./config.ts";
import { validateSeoConfig } from "./config.ts";

/** Resolve site URL from env with a localhost fallback for dev. */
export function resolveSiteUrl(fallback = "http://localhost:8012"): string {
	const fromEnv = process.env.AVALON_SITE_URL ?? process.env.SITE_URL;
	if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/+$/, "");
	return fallback.replace(/\/+$/, "");
}

/** Merge env site URL into a SEO plugin config object. */
export function withEnvSiteUrl(config: SeoConfigInput): ReturnType<typeof validateSeoConfig> {
	const siteUrl = resolveSiteUrl(
		typeof config.siteUrl === "string" ? config.siteUrl : "http://localhost:8012",
	);
	return validateSeoConfig({ ...config, siteUrl });
}
