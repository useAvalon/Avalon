/**
 * Nested Islands Demo Page
 * 
 * Demonstrates the nested islands feature with modular architecture.
 * Shows islands from different modules and how to handle name collisions.
 */

import { renderIsland } from '@avalon/avalon';

export default async function NestedIslandsDemo() {
  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem'
    }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#1a202c', marginBottom: '0.5rem' }}>
          🏝️ Nested Islands Demo
        </h1>
        <p style={{ color: '#718096', fontSize: '1.1rem' }}>
          Demonstrating modular architecture with islands in nested directories
        </p>
      </header>

      {/* Architecture Overview */}
      <section style={{ 
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f7fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ color: '#2d3748', marginTop: 0 }}>📁 Directory Structure</h2>
        <pre style={{ 
          backgroundColor: '#1a202c',
          color: '#e2e8f0',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.85rem',
          lineHeight: 1.6
        }}>
{`src/
├── islands/                          # Default islands (highest priority)
│   ├── Counter.tsx                  # → Qualified: "Counter"
│   ├── PreactCounter.tsx
│   └── ...
│
└── modules/
    ├── auth/
    │   └── islands/                  # Auth module islands
    │       ├── LoginForm.tsx        # → Qualified: "modules/auth/LoginForm"
    │       └── UserProfile.tsx      # → Qualified: "modules/auth/UserProfile"
    │
    └── dashboard/
        └── islands/                  # Dashboard module islands
            ├── StatsCard.tsx        # → Qualified: "modules/dashboard/StatsCard"
            ├── ActivityFeed.tsx     # → Qualified: "modules/dashboard/ActivityFeed"
            └── Counter.tsx          # → Qualified: "modules/dashboard/Counter" ⚠️`}
        </pre>
      </section>

      {/* Name Collision Demo */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#2d3748' }}>⚠️ Name Collision Handling</h2>
        <p style={{ color: '#718096', marginBottom: '1rem' }}>
          Both <code>src/islands/Counter.tsx</code> and <code>src/modules/dashboard/islands/Counter.tsx</code> exist.
          The default directory has priority for simple names.
        </p>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ color: '#4a5568', marginBottom: '0.5rem' }}>
              Default Counter (src/islands/)
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginBottom: '0.5rem' }}>
              <code>{"<Island src=\"Counter\" />"}</code> → resolves here
            </p>
            {await renderIsland({ 
              src: '/src/islands/Counter.tsx', 
              props: {}, 
              condition: 'on:interaction',
              framework: 'preact'
            })}
          </div>
          
          <div>
            <h4 style={{ color: '#4a5568', marginBottom: '0.5rem' }}>
              Dashboard Counter (modules/dashboard/)
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginBottom: '0.5rem' }}>
              <code>{"<Island src=\"modules/dashboard/Counter\" />"}</code>
            </p>
            {await renderIsland({ 
              src: '/src/modules/dashboard/islands/Counter.tsx', 
              props: {}, 
              condition: 'on:interaction',
              framework: 'preact'
            })}
          </div>
        </div>
      </section>

      {/* Auth Module */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#2d3748' }}>🔐 Auth Module Islands</h2>
        <p style={{ color: '#718096', marginBottom: '1rem' }}>
          Islands from <code>src/modules/auth/islands/</code>
        </p>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {await renderIsland({ 
            src: '/src/modules/auth/islands/LoginForm.tsx', 
            props: {}, 
            condition: 'on:client',
            framework: 'preact'
          })}
          {await renderIsland({ 
            src: '/src/modules/auth/islands/UserProfile.tsx', 
            props: {}, 
            condition: 'on:client',
            framework: 'preact'
          })}
        </div>
      </section>

      {/* Dashboard Module */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#2d3748' }}>📊 Dashboard Module Islands</h2>
        <p style={{ color: '#718096', marginBottom: '1rem' }}>
          Islands from <code>src/modules/dashboard/islands/</code>
        </p>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#4a5568', marginBottom: '1rem' }}>Stats Cards</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {await renderIsland({ 
              src: '/src/modules/dashboard/islands/StatsCard.tsx', 
              props: { title: 'Total Users', initialValue: 12847 }, 
              condition: 'on:client' 
            })}
            {await renderIsland({ 
              src: '/src/modules/dashboard/islands/StatsCard.tsx', 
              props: { title: 'Revenue', initialValue: 48293 }, 
              condition: 'on:client' 
            })}
            {await renderIsland({ 
              src: '/src/modules/dashboard/islands/StatsCard.tsx', 
              props: { title: 'Active Sessions', initialValue: 342 }, 
              condition: 'on:client' 
            })}
          </div>
        </div>

        <div>
          <h4 style={{ color: '#4a5568', marginBottom: '1rem' }}>Activity Feed</h4>
          {await renderIsland({ 
            src: '/src/modules/dashboard/islands/ActivityFeed.tsx', 
            props: {}, 
            condition: 'on:client' 
          })}
        </div>
      </section>

      {/* Resolution Order */}
      <section style={{ 
        padding: '1.5rem',
        backgroundColor: '#ebf8ff',
        borderRadius: '8px',
        border: '1px solid #bee3f8'
      }}>
        <h2 style={{ color: '#2b6cb0', marginTop: 0 }}>📋 Resolution Order</h2>
        <ol style={{ color: '#2c5282', lineHeight: 1.8 }}>
          <li><strong>Explicit path</strong> - <code>src/modules/auth/islands/LoginForm</code></li>
          <li><strong>Qualified name</strong> - <code>modules/auth/LoginForm</code></li>
          <li><strong>Default directory</strong> - <code>src/islands/</code> (highest priority for simple names)</li>
          <li><strong>Nested directories</strong> - alphabetically by namespace</li>
        </ol>
        
        <div style={{ 
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#fff',
          borderRadius: '4px',
          border: '1px solid #bee3f8'
        }}>
          <h4 style={{ color: '#2b6cb0', margin: '0 0 0.5rem' }}>Usage Examples:</h4>
          <pre style={{ 
            margin: 0,
            fontSize: '0.8rem',
            color: '#2c5282',
            whiteSpace: 'pre-wrap'
          }}>
{`// Simple name - resolves to default directory
<Island src="Counter" client:load />

// Qualified name - specific module
<Island src="modules/auth/LoginForm" client:load />

// Handle collision - use qualified name
<Island src="modules/dashboard/Counter" client:load />`}
          </pre>
        </div>
      </section>

      <footer style={{ 
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e2e8f0',
        color: '#a0aec0',
        fontSize: '0.875rem'
      }}>
        <p>
          This demo showcases the nested islands feature. 
          See <code>docs/02-core-concepts/islands-architecture.md</code> for full documentation.
        </p>
      </footer>
    </div>
  );
}
