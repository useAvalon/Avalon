import { appDefaults } from '../context/AppContext.tsx';
import ReactCounter from '../islands/ReactCounter.tsx';
import PreactCounter from '../islands/PreactCounter.tsx';
import LitCounter from '../islands/Counter.lit.ts';

function SiteInfo() {
	return (
		<div
			style={{
				background: '#f0f4ff',
				padding: '20px',
				borderRadius: '12px',
				border: '1px solid #d0d8f0',
				marginBottom: '20px',
			}}>
			<h3 style={{ color: '#4a5568', marginBottom: '10px' }}>📋 App Config</h3>
			<p>
				<strong>Site:</strong> {appDefaults.siteName} v{appDefaults.version}
			</p>
			<p>
				<strong>Environment:</strong> {appDefaults.environment}
			</p>
			<p>
				<strong>Features:</strong> {appDefaults.features.join(', ')}
			</p>
			<p>
				<strong>Initial Count:</strong> {appDefaults.initialCount} (passed to all islands below)
			</p>
		</div>
	);
}

async function IslandsFromContext() {
	const { initialCount } = appDefaults;

	return (
		<div style={{ marginBottom: '20px' }}>
			<h3 style={{ color: '#495057', marginBottom: '15px' }}>🏝️ Islands with Shared Config</h3>
			<p style={{ color: '#6c757d', marginBottom: '15px' }}>
				Each counter receives <code>initialCount={String(initialCount)}</code> from the shared app config. The value is
				read at the page level during SSR, then passed as props to each island — works across all frameworks.
			</p>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
					gap: '20px',
				}}>
				<ReactCounter island={{ condition: 'on:interaction' }} initialCount={initialCount} />
				<PreactCounter island={{ condition: 'on:interaction' }} initialCount={initialCount} />
				<LitCounter island={{ condition: 'on:interaction' }} initialCount={initialCount} />
			</div>
		</div>
	);
}

function CachedApiDemo() {
	return (
		<div
			style={{
				background: 'white',
				padding: '20px',
				borderRadius: '12px',
				border: '1px solid #e9ecef',
				marginBottom: '20px',
			}}>
			<h3 style={{ color: '#495057', marginBottom: '10px' }}>⚡ Nitro Cached API</h3>
			<p style={{ color: '#6c757d', marginBottom: '15px' }}>
				The <code>/api/cached-stats</code> endpoint uses <code>defineCachedFunction</code> from Nitro. Stats are cached
				for 60s with stale-while-revalidate.
			</p>
			<div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
				<a
					href="/api/cached-stats"
					target="_blank"
					style={{
						display: 'inline-block',
						padding: '10px 20px',
						background: 'linear-gradient(135deg, #667eea, #764ba2)',
						color: 'white',
						borderRadius: '8px',
						textDecoration: 'none',
						fontSize: '0.9rem',
					}}>
					Open /api/cached-stats →
				</a>
			</div>
			<div
				id="cache-result"
				style={{
					padding: '15px',
					background: '#f8f9fa',
					borderRadius: '8px',
					fontFamily: 'monospace',
					fontSize: '0.85rem',
					color: '#495057',
				}}>
				<em>Click the button below to fetch cached data live:</em>
			</div>
			<button
				type="button"
				id="fetch-cached"
				style={{
					marginTop: '10px',
					padding: '8px 16px',
					background: '#28a745',
					color: 'white',
					border: 'none',
					borderRadius: '6px',
					cursor: 'pointer',
					fontSize: '0.9rem',
				}}>
				Fetch /api/cached-stats
			</button>
			<script
				dangerouslySetInnerHTML={{
					__html: `
				document.getElementById('fetch-cached')?.addEventListener('click', async () => {
					const el = document.getElementById('cache-result');
					if (!el) return;
					el.textContent = 'Loading...';
					try {
						const res = await fetch('/api/cached-stats');
						const data = await res.json();
						el.textContent = JSON.stringify(data, null, 2);
					} catch (e) {
						el.textContent = 'Error: ' + e.message;
					}
				});
			`,
				}}
			/>
		</div>
	);
}

export default async function ServerCacheDemo() {
	const islandsSection = await IslandsFromContext();

	return (
		<div>
			<h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>Context + Islands + Nitro Cache</h2>
			<p style={{ color: '#6c757d', marginBottom: '20px' }}>
				This page demonstrates shared app config providing data to islands across frameworks, and Nitro's{' '}
				<strong>defineCachedFunction</strong> for server-side caching.
			</p>

			<SiteInfo />
			{islandsSection}
			<CachedApiDemo />
		</div>
	);
}
