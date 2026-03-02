import type { LayoutProps } from '@avalon/avalon';
import { AppProvider } from '../context/AppContext.tsx';

export default function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const pageTitle = frontmatter?.title || 'Avalon';
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{pageTitle}</title>
				{frontmatter?.description && <meta name="description" content={String(frontmatter.description)} />}
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap"
					rel="stylesheet"
				/>
				<link rel="stylesheet" href="/syntax-highlighting.css" />
				<style>{`
					* { margin: 0; padding: 0; box-sizing: border-box; }
					
					body {
						background: #0a0a0a;
						min-height: 100vh;
						font-family: 'DM Sans', system-ui, sans-serif;
						color: #fff;
						line-height: 1.6;
					}
					
					.scene {
						position: relative;
						min-height: 100vh;
					}
					
					.scene::before {
						content: '';
						position: fixed;
						inset: 0;
						background-image:
							linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
							linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
						background-size: 64px 64px;
						pointer-events: none;
						z-index: 0;
					}
					
					.scene::after {
						content: '';
						position: fixed;
						inset: 0;
						background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
						background-size: 32px 32px;
						pointer-events: none;
						z-index: 0;
					}
					
					.header {
						width:75vw;
						position: fixed;
						top: 16px;
						left: 50%;
						transform: translateX(-50%);
						z-index: 100;
						padding: 16px 32px;
						display: flex;
						align-items: center;
						gap: 64px;
						background: linear-gradient(137deg, rgba(17, 18, 20, .75) 4.87%, rgba(12, 13, 15, .9) 75.88%);
						backdrop-filter: blur(5px);
						-webkit-backdrop-filter: blur(20px);
						border: 1px solid rgba(255,255,255,0.1);
						border-radius: 16px;
						box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, .15);					
						}
					
					.logo {
						font-family: 'Instrument Serif', serif;
						font-size: 22px;
						font-style: italic;
						color: rgba(255,255,255,0.95);
						text-decoration: none;
						letter-spacing: -0.02em;
					}
					
					.nav {
						display: flex;
						align-items: center;
						gap: 4px;
						width:100%;
						justify-content:end;
					}
					
					.nav-link {
						color: rgba(255,255,255,0.55);
						text-decoration: none;
						padding: 8px 14px;
						font-size: 14px;
						font-weight: 500;
						transition: color 0.15s ease;
						border-radius: 100px;
					}
					
					.nav-link:hover {
						color: rgba(255,255,255,0.95);
						background: rgba(255,255,255,0.08);
					}
					
					.main {
						position: relative;
						z-index: 1;
						padding-top: 80px;
						min-height: 100vh;
					}
					
					.container {
						max-width: 1200px;
						margin: 0 auto;
						padding: 40px 24px;
					}
				`}</style>
			</head>
			<body>
				<AppProvider>
					<div className="scene">
						<header className="header">
							<a href="/" className="logo">Avalon</a>
							<nav className="nav">
								<a href="/frameworks" className="nav-link">Frameworks</a>
								<a href="/islands" className="nav-link">Islands</a>
								<a href="/layouts" className="nav-link">Layouts</a>
								<a href="/api-demo" className="nav-link">API</a>
								<a href="/blog" className="nav-link">Blog</a>
							</nav>
						</header>
						<main className="main">
							<div className="container">
								{children}
							</div>
						</main>
					</div>
				</AppProvider>
			</body>
		</html>
	);
}
