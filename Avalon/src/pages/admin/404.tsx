/**
 * Custom 404 Not Found Page for Admin Section
 *
 * This page is rendered when a route is not found within the /admin section.
 * It provides admin-specific styling and navigation options.
 */

export const metadata = {
  title: "404 - Admin Page Not Found | Avalon",
  description: "The admin page you're looking for doesn't exist.",
};

export default function AdminNotFoundPage() {
  return (
    <div className="admin-error-page">
      <style>{`
        .admin-error-page {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px;
          text-align: center;
          background: #1a1a2e;
          color: #eee;
        }
        .admin-error-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 30px;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        .admin-badge {
          background: #e94560;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .admin-error-code {
          font-size: 100px;
          font-weight: bold;
          margin: 0;
          line-height: 1;
          background: linear-gradient(135deg, #e94560 0%, #0f3460 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .admin-error-title {
          font-size: 28px;
          margin: 20px 0;
          font-weight: 600;
          color: #fff;
        }
        .admin-error-message {
          font-size: 16px;
          margin: 0 0 30px 0;
          color: #aaa;
          max-width: 400px;
        }
        .admin-error-actions {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .admin-error-link {
          display: inline-block;
          padding: 12px 24px;
          background: #e94560;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .admin-error-link:hover {
          background: #ff6b6b;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
        }
        .admin-error-link-secondary {
          background: transparent;
          color: #e94560;
          border: 2px solid #e94560;
        }
        .admin-error-link-secondary:hover {
          background: rgba(233, 69, 96, 0.1);
        }
        .admin-error-illustration {
          font-size: 60px;
          margin-bottom: 10px;
        }
        .admin-breadcrumb {
          margin-top: 40px;
          font-size: 14px;
          color: #666;
        }
        .admin-breadcrumb a {
          color: #e94560;
          text-decoration: none;
        }
        .admin-breadcrumb a:hover {
          text-decoration: underline;
        }
      `}</style>
      <div className="admin-error-header">
        <span className="admin-badge">Admin</span>
        <span>Dashboard</span>
      </div>
      <div className="admin-error-illustration">🔐</div>
      <h1 className="admin-error-code">404</h1>
      <h2 className="admin-error-title">Admin Page Not Found</h2>
      <p className="admin-error-message">
        The admin page you're looking for doesn't exist or may have been moved.
        Check the URL or navigate back to the admin dashboard.
      </p>
      <div className="admin-error-actions">
        <a href="/admin" className="admin-error-link">
          Admin Dashboard
        </a>
        <a href="/" className="admin-error-link admin-error-link-secondary">
          Main Site
        </a>
      </div>
      <div className="admin-breadcrumb">
        <a href="/">Home</a> / <a href="/admin">Admin</a> / 404
      </div>
    </div>
  );
}
