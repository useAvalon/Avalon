/**
 * Generic Error Page
 *
 * This page is used as a fallback for any error that doesn't have
 * a specific error page (like 404.tsx or 500.tsx).
 *
 * It receives error information as props and can display different
 * content based on the error type.
 */

export interface ErrorPageProps {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Error object (development only) */
  error?: Error;
  /** Stack trace (development only) */
  stack?: string;
  /** Request URL that caused the error */
  url?: string;
}

export const metadata = {
  title: "Error | Avalon",
  description: "An error occurred while processing your request.",
};

export default function ErrorPage(props: ErrorPageProps) {
  const { statusCode, message, stack, url } = props;
  const isDev = typeof window !== "undefined" 
    ? window.location.hostname === "localhost"
    : false;

  // Determine the error type for styling
  const isClientError = statusCode >= 400 && statusCode < 500;
  const gradientColors = isClientError
    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
  const accentColor = isClientError ? "#667eea" : "#f5576c";

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
          background: ${gradientColors};
          color: white;
        }
        .error-code {
          font-size: 100px;
          font-weight: bold;
          margin: 0;
          line-height: 1;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        }
        .error-title {
          font-size: 28px;
          margin: 20px 0;
          font-weight: 600;
        }
        .error-message {
          font-size: 16px;
          margin: 0 0 30px 0;
          opacity: 0.9;
          max-width: 500px;
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
          color: ${accentColor};
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .error-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .error-details {
          margin-top: 30px;
          text-align: left;
          max-width: 600px;
          width: 100%;
        }
        .error-details summary {
          cursor: pointer;
          padding: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          font-weight: 500;
        }
        .error-details pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.5;
          margin-top: 10px;
        }
        .error-url {
          font-size: 14px;
          opacity: 0.7;
          margin-top: 20px;
        }
      `}</style>
      <h1 className="error-code">{statusCode}</h1>
      <h2 className="error-title">{getStatusTitle(statusCode)}</h2>
      <p className="error-message">{message}</p>
      <div className="error-actions">
        <a href="/" className="error-link">
          Go Home
        </a>
      </div>
      {url && (
        <p className="error-url">
          Requested URL: {url}
        </p>
      )}
      {isDev && stack && (
        <details className="error-details">
          <summary>Error Details (Development Mode)</summary>
          <pre>{stack}</pre>
        </details>
      )}
    </div>
  );
}

function getStatusTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    410: "Gone",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return titles[statusCode] || "Something Went Wrong";
}
