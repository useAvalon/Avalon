import type { ProjectConfig } from '../types';

export function generateMainPage(config: ProjectConfig): string {
  return `export const metadata = {
  title: 'Avalon — Islands Architecture',
  description: 'A multi-framework islands architecture project powered by Avalon.',
};

export default async function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #0a0a12 0%, #0d1117 40%, #111827 100%)', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-40%', left: '-20%', width: '80%', height: '80%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-30%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px' }}>
        <p style={{ fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#818cf8', marginBottom: '1.5rem', fontWeight: 500 }}>Islands Architecture</p>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 1.5rem', background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Avalon
        </h1>

        <p style={{ fontSize: '1.15rem', lineHeight: 1.7, color: '#94a3b8', marginBottom: '2.5rem', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
          Multi-framework islands. Zero JS by default. Ship interactive components with any framework you love.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://useavalon.dev/docs/introduction" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'opacity 0.2s' }}>
            Documentation
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
          </a>
          <a href="https://github.com/useAvalon/Avalon" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'opacity 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, marginTop: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <p style={{ fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Get started</p>
        <code style={{ display: 'block', padding: '0.6rem 1.2rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#a5b4fc', fontSize: '0.85rem', fontFamily: 'ui-monospace, monospace' }}>
          Edit app/modules/main/pages/index.tsx
        </code>
      </div>

      <footer style={{ position: 'relative', zIndex: 1, marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.06)', width: '100%', maxWidth: '640px' }}>
        <p style={{ fontSize: '0.8rem', color: '#475569' }}>
          Powered by{' '}
          <a href="https://useavalon.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>Avalon</a>
        </p>
      </footer>
    </div>
  );
}
`;
}

export function generate404Page(): string {
  return `export const metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: 'noindex, nofollow',
};

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', padding: '2rem' }}>
      <h1 style={{ fontSize: '4rem', margin: '0 0 1rem' }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: '#64748b', margin: '0 0 2rem' }}>Page not found</p>
      <a href="/" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}>Go Home</a>
    </div>
  );
}
`;
}
