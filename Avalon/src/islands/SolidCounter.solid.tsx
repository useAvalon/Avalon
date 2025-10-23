/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function SolidCounter() {
	const [count, setCount] = createSignal(0);

	const containerStyle = {
		'text-align': 'center',
		padding: '20px',
		background: 'linear-gradient(135deg, #3a51b7ff, #2762b0ff)',
		color: 'white',
		'border-radius': '10px',
	};

	const valueStyle = {
		'font-size': '2em',
		margin: '10px 0',
	};

	const buttonStyle = {
		padding: '10px 20px',
		margin: '0 5px',
		'border-radius': '5px',
		border: 'none',
		background: 'rgba(255, 255, 255, 0.2)',
		color: 'white',
		cursor: 'pointer',
		'font-size': '1.2em',
	};

	const labelStyle = {
		'margin-top': '15px',
		opacity: '0.9',
	};

	return (
		<div style={containerStyle}>
			<h4>💎 Solid Counter</h4>
			<div style={valueStyle}>{count()}</div>
			<div>
				<button style={buttonStyle} onClick={() => setCount(count() - 1)}>
					−
				</button>
				<button style={buttonStyle} onClick={() => setCount(count() + 1)}>
					+
				</button>
			</div>
			<p style={labelStyle}>Powered by Solid signals with style objects!</p>
		</div>
	);
}