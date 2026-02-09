// Content component
function ContentSection({ label, priority, color }: { label: string; priority: string; color: string }) {
  return (
    <div style={{ padding: '20px', backgroundColor: color, borderRadius: '8px', marginBottom: '20px' }}>
      <h2>✅ {label}</h2>
      <p>Priority: {priority}</p>
      <p>This content renders as part of the HTML response.</p>
    </div>
  );
}

export default function StreamingDemo() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <h1>🚀 HTML Streaming Demo</h1>
      <p style={{ fontSize: '18px', color: '#666', marginBottom: '40px' }}>
        This page demonstrates HTML streaming capabilities in Avalon.
        All content renders efficiently as part of the HTML response.
      </p>

      {/* High priority content */}
      <ContentSection label="High Priority Content" priority="High" color="#e8f5e9" />

      {/* Medium priority content */}
      <ContentSection label="Medium Priority Content" priority="Medium" color="#fff3e0" />

      {/* Another section */}
      <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>✅ Multi-Section Layout</h2>
        <p>This page demonstrates multiple content sections rendering together.</p>
        <p>All content is delivered efficiently in the HTML response.</p>
      </div>

      {/* Low priority content */}
      <ContentSection label="Low Priority Content" priority="Low" color="#f3e5f5" />

      {/* Additional content */}
      <ContentSection label="Additional Content" priority="Normal" color="#fff9c4" />

      {/* Final section */}
      <div style={{ padding: '20px', backgroundColor: '#f3e5f5', borderRadius: '8px', marginTop: '20px' }}>
        <h2>✅ Final Section</h2>
        <p>All content renders as part of the initial HTML response.</p>
        <p>The page is immediately interactive and fully functional.</p>
      </div>

      {/* Info section */}
      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        backgroundColor: '#fff9c4', 
        borderRadius: '8px',
        borderLeft: '4px solid #fbc02d'
      }}>
        <h3>💡 How This Works</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Server-Side Rendering:</strong> All content is rendered on the server</li>
          <li><strong>HTML Streaming:</strong> The HTML response is streamed to the browser efficiently</li>
          <li><strong>Fast TTFB:</strong> Time to First Byte is optimized for quick initial response</li>
          <li><strong>Better UX:</strong> Users see content immediately without loading states</li>
        </ul>
      </div>
    </div>
  );
}
