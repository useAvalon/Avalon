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
			setResult({ error: error });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			style={{
				background: 'linear-gradient(135deg, #667eea, #764ba2)',
				color: 'white',
				padding: '25px',
				borderRadius: '12px',
			}}>
			<h4 style={{ marginBottom: '20px' }}>🧪 Live API Tester</h4>

			<div style={{ marginBottom: '20px' }}>
				<label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Select API Endpoint:</label>
				<select
					value={selectedApi}
					onChange={e => setSelectedApi((e.target as HTMLSelectElement).value)}
					style={{
						width: '100%',
						padding: '10px',
						borderRadius: '6px',
						border: 'none',
						background: 'rgba(255,255,255,0.9)',
						color: '#333',
					}}>
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
					background: loading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
					border: 'none',
					borderRadius: '6px',
					color: 'white',
					cursor: loading ? 'not-allowed' : 'pointer',
					fontSize: '1rem',
					marginBottom: '20px',
				}}>
				{loading ? '🔄 Testing...' : '🚀 Test API'}
			</button>

			{result && (
				<div
					style={{
						background: 'rgba(255,255,255,0.1)',
						padding: '15px',
						borderRadius: '8px',
						marginTop: '15px',
					}}>
					<h5 style={{ marginBottom: '10px' }}>📋 Response:</h5>
					<pre
						style={{
							background: 'rgba(0,0,0,0.2)',
							padding: '12px',
							borderRadius: '6px',
							fontSize: '0.8rem',
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
