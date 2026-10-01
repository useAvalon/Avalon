/** Collect same-origin path links from prerendered HTML (no query or hash). */
export function extractLinks(html: string): string[] {
	const links: string[] = [];
	let i = 0;
	while (i < html.length) {
		const anchorStart = html.indexOf("<a", i);
		if (anchorStart === -1) break;

		const tagEnd = html.indexOf(">", anchorStart);
		if (tagEnd === -1) break;

		const tag = html.slice(anchorStart, tagEnd + 1);
		const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(tag);
		i = tagEnd + 1;
		if (!hrefMatch) continue;

		let href = hrefMatch[1];
		const hashIdx = href.indexOf("#");
		if (hashIdx !== -1) href = href.slice(0, hashIdx);
		const queryIdx = href.indexOf("?");
		if (queryIdx !== -1) href = href.slice(0, queryIdx);

		if (href?.startsWith("/") && !href.startsWith("//") && !href.includes(".")) {
			links.push(href);
		}
	}
	return links;
}
