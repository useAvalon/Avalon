/**
 * Netlify build wrapper
 *
 * Runs `vite build` and force-exits the process afterward.
 * Bun's runtime can keep the process alive due to open handles
 * from Nitro's build pipeline. This wrapper ensures clean exit.
 */
import { build } from 'vite';

try {
	await build();
	console.log('Build complete, exiting.');
	process.exit(0);
} catch (error) {
	console.error('Build failed:', error);
	process.exit(1);
}
