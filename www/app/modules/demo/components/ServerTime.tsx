/** @jsxImportSource preact */

export default function ServerTime() {
	const now = new Date();
	return (
		<div class="server-time">
			<span class="server-time__value">Server Time: {now.toLocaleTimeString()}</span>
			<small class="server-time__note">Rendered on-demand by the server</small>
			<style>{`
				.server-time {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 0.5rem;
					padding: 1.5rem;
					border-radius: 12px;
					background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
					border: 1px solid rgba(99, 102, 241, 0.2);
					font-family: system-ui, sans-serif;
				}
				.server-time__value {
					font-size: 1.25rem;
					font-weight: 600;
					color: #a5b4fc;
					font-family: monospace;
				}
				.server-time__note {
					font-size: 0.75rem;
					color: #6b7280;
				}
			`}</style>
		</div>
	);
}
