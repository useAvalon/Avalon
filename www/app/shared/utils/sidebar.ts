export interface SidebarItem {
	title: string;
	href: string;
}

export interface SidebarCategory {
	label: string;
	items: SidebarItem[];
}

export const SIDEBAR: SidebarCategory[] = [
	{
		label: 'GETTING STARTED',
		items: [
			{ title: 'Introduction', href: '/docs/introduction' },
			{ title: 'Installation', href: '/docs/installation' },
			{ title: 'Quick Start', href: '/docs/quick-start' },
		],
	},
	{
		label: 'CORE CONCEPTS',
		items: [
			{ title: 'Islands Architecture', href: '/docs/islands-architecture' },
			{ title: 'Hydration Strategies', href: '/docs/hydration-strategies' },
			{ title: 'File-System Routing', href: '/docs/file-system-routing' },
			{ title: 'Layouts', href: '/docs/layouts' },
			{ title: 'Page Metadata', href: '/docs/metadata' },
		],
	},
	{
		label: 'FRAMEWORKS',
		items: [
			{ title: 'React', href: '/docs/frameworks/react' },
			{ title: 'Preact', href: '/docs/frameworks/preact' },
			{ title: 'Vue', href: '/docs/frameworks/vue' },
			{ title: 'Svelte', href: '/docs/frameworks/svelte' },
			{ title: 'Solid', href: '/docs/frameworks/solid' },
			{ title: 'Lit', href: '/docs/frameworks/lit' },
		],
	},
	{
		label: 'API REFERENCE',
		items: [
			{ title: 'island prop', href: '/docs/api/island-prop' },
			{ title: 'layoutConfig', href: '/docs/api/layout-config' },
			{ title: 'File Conventions', href: '/docs/api/file-conventions' },
		],
	},
	{
		label: 'GUIDES',
		items: [
			{ title: 'Deployment', href: '/docs/guides/deployment' },
			{ title: 'Performance', href: '/docs/guides/performance' },
		],
	},
	{
		label: 'PLUGINS',
		items: [
			{ title: 'Agent Optimization', href: '/docs/plugins/agent-optimization' },
		],
	},
];

export const ALL_SIDEBAR_HREFS: string[] = SIDEBAR.flatMap(c => c.items.map(i => i.href));

export interface SidebarState {
	activeHref: string | null;
	expandedCategory: string | null;
}

export function getSidebarState(path: string): SidebarState {
	for (const category of SIDEBAR) {
		for (const item of category.items) {
			if (item.href === path) {
				return { activeHref: item.href, expandedCategory: category.label };
			}
		}
	}
	return { activeHref: null, expandedCategory: null };
}

export interface PrevNext {
	prev: SidebarItem | undefined;
	next: SidebarItem | undefined;
}

export function getPrevNext(path: string): PrevNext {
	const idx = ALL_SIDEBAR_HREFS.indexOf(path);
	if (idx === -1) return { prev: undefined, next: undefined };
	const flat = SIDEBAR.flatMap(c => c.items);
	return {
		prev: idx > 0 ? flat[idx - 1] : undefined,
		next: idx < flat.length - 1 ? flat[idx + 1] : undefined,
	};
}
