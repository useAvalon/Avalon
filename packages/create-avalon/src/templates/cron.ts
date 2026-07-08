import type { ProjectConfig } from "../types";

/** Path (relative to project root) of the example task file. */
export const EXAMPLE_CRON_HANDLER = "tasks/cleanup.ts";

/** Schedule used for the example job — hourly, on the hour. */
export const EXAMPLE_CRON_SCHEDULE = "0 * * * *";

/**
 * Generates an example cron task. Task files live in `tasks/` and default-export
 * a job created with `defineCronJob`. The schedule is wired up in vite.config.ts
 * under `nitro.cron`.
 */
export function generateExampleCronTask(_config: ProjectConfig): string {
	return `import { defineCronJob } from '@useavalon/avalon/cron';

/**
 * Example scheduled job. Runs on the schedule defined in vite.config.ts
 * (\`nitro.cron\`). The task name is derived from this file path: "cleanup".
 *
 * In production this runs via your deployment preset's scheduler
 * (Vercel Cron, Cloudflare Triggers, or the Node server's in-process
 * scheduler). In development Avalon runs it inside the Vite dev server.
 */
export default defineCronJob({
  meta: { description: 'Example scheduled job' },
  async run() {
    console.log('[cron] cleanup ran at', new Date().toISOString());
    // TODO: replace with your scheduled work.
    return { result: 'ok' };
  },
});
`;
}
