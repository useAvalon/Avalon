/**
 * Returns which nav link keys are active based on path prefix matching.
 * Keys correspond to nav link identifiers: 'docs', 'blog'
 */
export function getActiveNavLinks(currentPath: string): string[] {
	const active: string[] = [];
	if (currentPath === "/docs" || currentPath.startsWith("/docs/")) active.push("docs");
	if (currentPath === "/blog" || currentPath.startsWith("/blog/")) active.push("blog");
	return active;
}
