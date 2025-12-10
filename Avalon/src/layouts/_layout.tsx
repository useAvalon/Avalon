import type { LayoutProps } from '@avalon/avalon';

export default function RootLayout({ children, frontmatter }: LayoutProps) {
	// Use title from frontmatter if available, otherwise use default
	const pageTitle = frontmatter?.title || 'Avalon Demo';
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{pageTitle}</title>
				{frontmatter?.description && <meta name="description" content={frontmatter.description} />}
				<link rel="stylesheet" href="/syntax-highlighting.css" />
				<link
					rel="stylesheet"
					href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
				/>
				<style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .nav {
            display: flex;
            gap: 20px;
            margin-top: 15px;
          }
          .nav a {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
          }
          .nav a:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
          }
          .content {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          h1 { color: white; font-size: 2.5rem; margin-bottom: 10px; }
          .subtitle { color: rgba(255, 255, 255, 0.8); font-size: 1.1rem; }
        `}</style>
			</head>
			<body>
				<div class="container">
					<header class="header">
						<h1>🏔️ Avalon Framework Demo</h1>
						<p class="subtitle">Showcasing multi-framework SSR with islands architecture</p>
						<nav class="nav">
							<a href="/">Home</a>
							<a href="/frameworks">Frameworks</a>
							<a href="/islands">Islands</a>
							<a href="/layouts">Layouts</a>
							<a href="/api-demo">API Demo</a>
							<a href="/blog">Blog</a>
						</nav>
					</header>
					<main class="content" dangerouslySetInnerHTML={{ __html: children }}></main>
				</div>
			</body>
		</html>
	);
}
