/**
 * Custom 500 Internal Server Error Page
 *
 * This page is automatically rendered when a server error occurs.
 * It provides a user-friendly error message without exposing internal details.
 */

export const metadata = {
  title: "500 - Server Error | Avalon",
  description: "An unexpected error occurred on the server.",
};

export default function ServerErrorPage() {
  return (
    <div className="error-page">
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
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
          max-width: 450px;
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
          color: #f5576c;
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
      <div className="error-illustration">⚠️</div>
      <h1 className="error-code">500</h1>
      <h2 className="error-title">Server Error</h2>
      <p className="error-message">
        Something went wrong on our end. Our team has been notified and is working on it.
        Please try again in a few moments.
      </p>
      <div className="error-actions">
        <a href="/" className="error-link">
          Go Home
        </a>
        <a href="javascript:location.reload()" className="error-link error-link-secondary">
          Try Again
        </a>
      </div>
    </div>
  );
}
