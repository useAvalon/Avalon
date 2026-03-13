import Counter from '../components/Counter.qwik.tsx';

export const metadata = {
	title: 'Qwik Demo',
	description: 'Temporary demo page to test Qwik island integration',
};

export default async function DemoPage() {
	return (
		<div style={{
			minHeight: '80vh',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: '2rem',
			padding: '2rem',
		}}>
			<h1 style={{ fontSize: '1.8rem', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
				Qwik Island Demo
			</h1>
			<p style={{ color: '#999', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', textAlign: 'center' }}>
				This counter uses Qwik's resumability model. The component resumes instantly
				from server-rendered HTML without a hydration step.
			</p>
			<Counter island={{ condition: 'on:client' }} />
		</div>
	);
}
