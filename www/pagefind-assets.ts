/** Bust browser HTTP cache for Pagefind after deploy (CDN purge does not clear disk cache). */
export function pagefindAssetUrl(path: string): string {
	const rev = typeof __AVALON_DEPLOY_REVISION__ !== "undefined" ? __AVALON_DEPLOY_REVISION__ : "";
	if (!rev || rev === "dev") return path;
	return `${path}?v=${encodeURIComponent(rev.slice(0, 12))}`;
}
