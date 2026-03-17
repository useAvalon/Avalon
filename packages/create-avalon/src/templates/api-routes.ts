import type { ProjectConfig } from '../types';

export function generateHelloRoute(config: ProjectConfig): string {
  switch (config.middleware) {
    case 'h3':
      return generateH3Route();
    case 'hono':
      return generateHonoRoute();
    case 'elysia':
      return generateElysiaRoute();
  }
}

function generateH3Route(): string {
  return `import { defineHandler } from 'nitro/h3';

export default defineHandler(() => {
  return { message: 'Hello from Avalon!' };
});
`;
}

function generateHonoRoute(): string {
  return `import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Hello from Avalon!' });
});

export default app;
`;
}

function generateElysiaRoute(): string {
  return `import { Elysia } from 'elysia';

export default new Elysia()
  .get('/', () => ({ message: 'Hello from Avalon!' }));
`;
}
