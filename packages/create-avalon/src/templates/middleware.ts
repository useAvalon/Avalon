import type { ProjectConfig } from '../types';

export function generateSampleMiddleware(_config: ProjectConfig): string {
	return `import { defineHandler } from 'nitro';

export default defineHandler((event) => {
  console.log(\`[\${new Date().toISOString()}] \${event.req.method} \${event.url.pathname}\`);
});
`;
}
