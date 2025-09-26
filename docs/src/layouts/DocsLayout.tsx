import { Navigation, defaultNavigationItems } from '../components/Navigation.tsx';

export interface DocsLayoutProps {
	children: any;
	currentPath: string;
	title?: string;
	description?: string;
}

export function DocsLayout({ children, currentPath, title, description }: DocsLayoutProps) {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title ? `${title} | Avalon Documentation` : 'Avalon Documentation'}</title>
				{description && <meta name="description" content={description} />}

				{/* Preload fonts */}
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
				<link
					href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap"
					rel="stylesheet"
				/>

				{/* Styles */}
				<link rel="stylesheet" href="/styles/main.css" />
				<link rel="stylesheet" href="/styles/navigation.css" />
				<link rel="stylesheet" href="/styles/syntax-highlighting.css" />

				{/* Favicon */}
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />

				{/* Open Graph */}
				<meta property="og:title" content={title || 'Avalon Documentation'} />
				<meta
					property="og:description"
					content={description || 'Comprehensive documentation for the Avalon framework'}
				/>
				<meta property="og:type" content="website" />
				<meta property="og:site_name" content="Avalon Framework" />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title || 'Avalon Documentation'} />
				<meta
					name="twitter:description"
					content={description || 'Comprehensive documentation for the Avalon framework'}
				/>
			</head>
			<body>
				<div class="docs-container">
					<Navigation items={defaultNavigationItems} currentPath={currentPath} />

					<main class="docs-main">
						<div class="docs-content">{children}</div>

						<footer class="docs-footer">
							<div class="footer-content">
								<p>&copy; 2024 Avalon Framework. Built with Avalon.</p>
								<div class="footer-links">
									<a href="https://github.com/avalon-framework/avalon" target="_blank" rel="noopener noreferrer">
										GitHub
									</a>
									<a href="/docs/06-migration/decision-guides/community-resources">Community</a>
									<a href="/docs/CONTRIBUTING">Contributing</a>
								</div>
							</div>
						</footer>
					</main>
				</div>

				{/* Scripts */}
				<script src="/scripts/main.js" defer></script>
			</body>
		</html>
	);
}
