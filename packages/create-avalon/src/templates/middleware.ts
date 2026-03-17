import type { ProjectConfig } from '../types';

export function generateSampleMiddleware(config: ProjectConfig): string {
  switch (config.middleware) {
    case 'h3':
      return generateH3Middleware();
    case 'hono':
      return generateHonoMiddleware();
    case 'elysia':
      return generateElysiaMiddleware();
  }
}

function generateH3Middleware(): string {
  return `import { defineHandler } from 'nitro/h3';

export default defineHandler((event) => {
  console.log(\`[\${new Date().toISOString()}] \${event.method} \${event.path}\`);
});
`;
}

function generateHonoMiddleware(): string {
  return `import { Hono } from 'hono';

const app = new Hono();

app.use('*', async (c, next) => {
  console.log(\`[\${new Date().toISOString()}] \${c.req.method} \${c.req.path}\`);
  await next();
});

export default app;
`;
}

function generateElysiaMiddleware(): string {
  return `import { Elysia } from 'elysia';

export default new Elysia()
  .onBeforeHandle(({ request }) => {
    console.log(\`[\${new Date().toISOString()}] \${request.method} \${new URL(request.url).pathname}\`);
  });
`;
}
