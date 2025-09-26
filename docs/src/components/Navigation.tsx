import { useState } from 'preact/hooks';

export interface NavigationItem {
	title: string;
	path: string;
	children?: NavigationItem[];
	icon?: string;
	description?: string;
}

export interface NavigationProps {
	items: NavigationItem[];
	currentPath: string;
	onNavigate?: (path: string) => void;
}

export function Navigation({ items, currentPath, onNavigate }: NavigationProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

	const toggleSection = (path: string) => {
		const newExpanded = new Set(expandedSections);
		if (newExpanded.has(path)) {
			newExpanded.delete(path);
		} else {
			newExpanded.add(path);
		}
		setExpandedSections(newExpanded);
	};

	const handleNavigate = (path: string) => {
		onNavigate?.(path);
		setMobileMenuOpen(false);
	};

	const isActive = (path: string) => {
		return currentPath === path || currentPath.startsWith(path + '/');
	};

	const renderNavigationItem = (item: NavigationItem, level = 0) => {
		const hasChildren = item.children && item.children.length > 0;
		const isExpanded = expandedSections.has(item.path);
		const active = isActive(item.path);

		return (
			<li key={item.path} className={`nav-item nav-item-level-${level}`}>
				<div className={`nav-link-container ${active ? 'active' : ''}`}>
					<a
						href={item.path}
						className="nav-link"
						onClick={e => {
							e.preventDefault();
							handleNavigate(item.path);
						}}
						aria-current={active ? 'page' : undefined}>
						{item.icon && <span className="nav-icon">{item.icon}</span>}
						<span className="nav-text">{item.title}</span>
					</a>
					{hasChildren && (
						<button
							className={`nav-toggle ${isExpanded ? 'expanded' : ''}`}
							onClick={() => toggleSection(item.path)}
							aria-expanded={isExpanded}
							aria-label={`Toggle ${item.title} section`}>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
								<path d="M4.427 9.573L8 6l3.573 3.573a.5.5 0 0 0 .708-.708L8.354 4.939a.5.5 0 0 0-.708 0L3.72 8.865a.5.5 0 1 0 .708.708z" />
							</svg>
						</button>
					)}
				</div>
				{hasChildren && (
					<ul className={`nav-children ${isExpanded ? 'expanded' : ''}`}>
						{item.children!.map(child => renderNavigationItem(child, level + 1))}
					</ul>
				)}
			</li>
		);
	};

	return (
		<nav className="documentation-nav" role="navigation" aria-label="Documentation navigation">
			{/* Mobile menu button */}
			<button
				className="mobile-menu-button"
				onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
				aria-expanded={mobileMenuOpen}
				aria-label="Toggle navigation menu">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					{mobileMenuOpen ? (
						<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					) : (
						<path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
					)}
				</svg>
			</button>

			{/* Navigation menu */}
			<div className={`nav-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
				<div className="nav-header">
					<h2 className="nav-title">Documentation</h2>
				</div>

				<ul className="nav-list">{items.map(item => renderNavigationItem(item))}</ul>
			</div>

			{/* Mobile overlay */}
			{mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />}
		</nav>
	);
}

// Default navigation structure
export const defaultNavigationItems: NavigationItem[] = [
	{
		title: 'Getting Started',
		path: '/docs/01-getting-started',
		icon: '🚀',
		description: 'Quick onboarding and your first Avalon application',
		children: [
			{ title: 'Installation', path: '/docs/01-getting-started/installation' },
			{ title: 'Quick Start', path: '/docs/01-getting-started/quick-start' },
			{ title: 'Project Structure', path: '/docs/01-getting-started/project-structure' },
			{ title: 'First Island', path: '/docs/01-getting-started/first-island' },
			{ title: 'Deployment', path: '/docs/01-getting-started/deployment' },
		],
	},
	{
		title: 'Core Concepts',
		path: '/docs/02-core-concepts',
		icon: '🏗️',
		description: "Understanding Avalon's architecture and philosophy",
		children: [
			{ title: 'Islands Architecture', path: '/docs/02-core-concepts/islands-architecture' },
			{ title: 'Multi-Framework Support', path: '/docs/02-core-concepts/multi-framework-support' },
			{ title: 'File-System Routing', path: '/docs/02-core-concepts/file-system-routing' },
			{ title: 'Server-Side Rendering', path: '/docs/02-core-concepts/server-side-rendering' },
			{ title: 'Build System', path: '/docs/02-core-concepts/build-system' },
		],
	},
	{
		title: 'Features',
		path: '/docs/03-features',
		icon: '⚡',
		description: 'Detailed guides for implementing specific functionality',
		children: [
			{
				title: 'Islands & Components',
				path: '/docs/03-features/islands',
				children: [
					{ title: 'Creating Islands', path: '/docs/03-features/islands/creating-islands' },
					{ title: 'Hydration Strategies', path: '/docs/03-features/islands/hydration-strategies' },
					{ title: 'State Management', path: '/docs/03-features/islands/state-management' },
					{ title: 'Error Boundaries', path: '/docs/03-features/islands/error-boundaries' },
				],
			},
			{
				title: 'Routing System',
				path: '/docs/03-features/routing',
				children: [
					{ title: 'Static Routes', path: '/docs/03-features/routing/static-routes' },
					{ title: 'Dynamic Routes', path: '/docs/03-features/routing/dynamic-routes' },
					{ title: 'Nested Layouts', path: '/docs/03-features/routing/nested-layouts' },
					{ title: 'Route Guards', path: '/docs/03-features/routing/route-guards' },
				],
			},
			{
				title: 'Metadata & SEO',
				path: '/docs/03-features/metadata',
				children: [
					{ title: 'Page Metadata', path: '/docs/03-features/metadata/page-metadata' },
					{ title: 'Dynamic Metadata', path: '/docs/03-features/metadata/dynamic-metadata' },
					{ title: 'SEO Optimization', path: '/docs/03-features/metadata/seo-optimization' },
					{ title: 'Structured Data', path: '/docs/03-features/metadata/structured-data' },
				],
			},
		],
	},
	{
		title: 'API Reference',
		path: '/docs/04-api-reference',
		icon: '📚',
		description: 'Complete technical reference for all APIs',
		children: [
			{ title: 'Component APIs', path: '/docs/04-api-reference/components' },
			{ title: 'Server Configuration', path: '/docs/04-api-reference/server' },
			{ title: 'Metadata APIs', path: '/docs/04-api-reference/metadata' },
			{ title: 'Utility Functions', path: '/docs/04-api-reference/utilities' },
			{ title: 'TypeScript Support', path: '/docs/04-api-reference/typescript' },
		],
	},
	{
		title: 'Guides',
		path: '/docs/05-guides',
		icon: '🎯',
		description: 'Best practices and advanced implementation guidance',
		children: [
			{ title: 'Best Practices', path: '/docs/05-guides/best-practices' },
			{ title: 'Advanced Patterns', path: '/docs/05-guides/advanced-patterns' },
			{ title: 'Deployment & Production', path: '/docs/05-guides/deployment' },
			{ title: 'Troubleshooting', path: '/docs/05-guides/troubleshooting' },
		],
	},
	{
		title: 'Migration',
		path: '/docs/06-migration',
		icon: '🔄',
		description: 'Framework comparisons and migration guides',
		children: [
			{ title: 'Framework Comparisons', path: '/docs/06-migration/comparisons' },
			{ title: 'Migration Guides', path: '/docs/06-migration/migration-guides' },
			{ title: 'Ecosystem Integration', path: '/docs/06-migration/ecosystem' },
			{ title: 'Decision Guides', path: '/docs/06-migration/decision-guides' },
		],
	},
];
