/**
 * Custom 404 Not Found Page
 *
 * This page is automatically rendered when a route is not found.
 * It provides a user-friendly error message and navigation back to home.
 */

export const metadata = {
	title: "404 - Page Not Found | Avalon",
	description: "The page you're looking for doesn't exist.",
	robots: "noindex, nofollow",
};

export default function NotFoundPage() {
	return (
		<div class="error-page">
			<style>{`
        .error-page {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .error-code {
          font-size: 120px;
          font-weight: bold;
          margin: 0;
          line-height: 1;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        }
        .error-title {
          font-size: 32px;
          margin: 20px 0;
          font-weight: 600;
        }
        .error-message {
          font-size: 18px;
          margin: 0 0 30px 0;
          opacity: 0.9;
          max-width: 400px;
        }
        .error-actions {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .error-link {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .error-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .error-link-secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
        }
        .error-link-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .error-illustration {
          font-size: 80px;
          margin-bottom: 20px;
        }
      `}</style>
			<div class="error-illustration">🔍</div>
			<h1 class="error-code">404</h1>
			<h2 class="error-title">Page Not Found</h2>
			<p class="error-message">
				Oops! The page you're looking for seems to have wandered off. Let's get you back on track.
			</p>
			<div class="error-actions">
				<a href="/" class="error-link">
					Go Home
				</a>
				<a href="#" onClick="history.back();return false" class="error-link error-link-secondary">
					Go Back
				</a>
			</div>
		</div>
	);
}
