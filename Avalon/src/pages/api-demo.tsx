/** @jsxImportSource preact */

import ApiTester from '../islands/ApiTester.tsx';
import styles from './api-demo.module.css';

export default async function ApiDemoPage() {
	return (
		<div>
			<header className={styles.header}>
				<div className={styles.pill}>Server Routes</div>
				<h1 className={styles.title}>API Routes</h1>
				<p className={styles.subtitle}>
					File-based API routes with middleware support, powered by Nitro.
				</p>
			</header>

			<div className={styles.endpointGrid}>
				<div className={styles.endpointCard}>
					<h3 className={styles.endpointTitle}>GET /api/hello</h3>
					<p className={styles.endpointDesc}>Simple hello world endpoint</p>
					<a href="/api/hello" target="_blank" className={styles.tryLink}>Try it →</a>
				</div>

				<div className={styles.endpointCard}>
					<h3 className={styles.endpointTitle}>GET /api/time</h3>
					<p className={styles.endpointDesc}>Returns current server time</p>
					<a href="/api/time" target="_blank" className={styles.tryLink}>Try it →</a>
				</div>

				<div className={styles.endpointCard}>
					<h3 className={styles.endpointTitle}>GET /api/users/:id</h3>
					<p className={styles.endpointDesc}>Dynamic route with parameters</p>
					<a href="/api/users/123" target="_blank" className={styles.tryLink}>Try it →</a>
				</div>
			</div>

			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>Interactive Tester</h3>
				<ApiTester island={{ condition: 'on:interaction' }} />
			</div>

			<div className={styles.sectionLast}>
				<h3 className={styles.sectionTitle}>File Structure</h3>
				<pre className={styles.codeBlock}>{`routes/
└── api/
    ├── _middleware.ts   ← Runs before all API routes
    ├── hello.ts         ← GET /api/hello
    ├── time.ts          ← GET /api/time
    └── users/
        └── [id].ts      ← GET /api/users/:id`}</pre>
			</div>
		</div>
	);
}
