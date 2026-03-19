import type { ProjectConfig } from '../types';

export function generateHelloRoute(_config: ProjectConfig): string {
	return `import { defineHandler } from 'nitro';

export default defineHandler(() => {
  return Response.json({ message: 'Hello from Avalon!' });
});
`;
}
