/**
 * Netlify build wrapper
 *
 * The bun runtime keeps open handles from Nitro's vite plugin alive
 * after the build completes, preventing process exit. This wrapper
 * monitors stdout for Nitro's final output line and force-exits.
 */
import { spawn } from 'node:child_process';

const child = spawn('bunx', ['--bun', 'vite', 'build'], {
	stdio: ['inherit', 'pipe', 'inherit'],
	shell: true,
});

child.stdout.on('data', chunk => {
	process.stdout.write(chunk);
	if (chunk.toString().includes('nitro.json')) {
		setTimeout(() => process.exit(0), 2000);
	}
});

child.on('close', code => process.exit(code ?? 0));
child.on('error', () => process.exit(1));
