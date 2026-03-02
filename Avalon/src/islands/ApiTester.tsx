/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function ApiTester() {
	const [result, setResult] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [selectedApi, setSelectedApi] = useState('/api/hello');

	const testApi = async () => {
		setLoading(true);
		try {
			const response = await fetch(selectedApi);
			const data = await response.json();
			setResult({ status: response.status, data });
		} catch (error) {
			setResult({ error: String(error) });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<div style={{ marginBottom: '16px' }}>
				<label style={{
					display: 'block',
					marginBottom: '8px',
					fontSize: '13px',
					color: 'rgba(255,255,255,0.5)',
				}}>
					Select endpoint:
				</label>
				<select
					value={selectedApi}
					onChange={e => setSelectedApi((e.target as HTMLSelectElement).value)}
					style={{
						width: '100%',
						padding: '12px',
						borderRadius: '8px',
						border: '1px solid rgba(255,255,255,0.1)',
						background: 'rgba(255,255,255,0.04)',
						color: 'rgba(255,255,255,0.9)',
						fontSize: '14px',
						cursor: 'pointer',
					}}
				>
					<option value="/api/hello">GET /api/hello</option>
					<option value="/api/hello?name=Avalon">GET /api/hello?name=Avalon</option>
					<option value="/api/time">GET /api/time</option>
					<option value="/api/users/123">GET /api/users/123</option>
					<option value="/api/users/999">GET /api/users/999 (404 test)</option>
				</select>
			</div>

			<button
				onClick={testApi}
				disabled={loading}
				style={{
					width: '100%',
					padding: '12px',
					background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
					border: '1px solid transparent',
					borderRadius: '8px',
					color: loading ? 'rgba(255,255,255,0.4)' : '#0a0a0a',
					cursor: loading ? 'not-allowed' : 'pointer',
					fontSize: '14px',
					fontWeight: '500',
					transition: 'all 0.2s ease',
				}}
			>
				{loading ? 'Testing...' : 'Send Request'}
			</button>

			{result && (
				<div style={{ marginTop: '20px' }}>
					<div style={{
						fontSize: '12px',
						color: 'rgba(255,255,255,0.4)',
						marginBottom: '8px',
						textTransform: 'uppercase',
						letterSpacing: '0.05em',
					}}>
						Response
					</div>
					<pre style={{
						background: 'rgba(0,0,0,0.3)',
						border: '1px solid rgba(255,255,255,0.06)',
						borderRadius: '8px',
						padding: '16px',
						color: 'rgba(255,255,255,0.7)',
						fontSize: '13px',
						overflow: 'auto',
						whiteSpace: 'pre-wrap',
					}}>
						{JSON.stringify(result, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
