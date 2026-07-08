import { z } from "zod";

/**
 * Cron / scheduled task schemas for Avalon.
 *
 * Avalon's cron support is a thin, first-class layer over Nitro v3's native
 * task scheduler (which uses `croner` under the hood). A cron config maps a
 * schedule to a task, and Nitro registers the appropriate scheduled runner for
 * the active deployment preset (Vercel cron, Cloudflare triggers, or the
 * built-in in-process scheduler for the node-server preset).
 *
 * Two ways to reference the code that runs on a schedule:
 *
 * 1. `handler` — a path to a task file (relative to the project root). Avalon
 *    registers it as a Nitro task and schedules it. The task file default-exports
 *    a task created with `defineCronJob` (or Nitro's `defineTask`).
 *
 * 2. `task` — the name of a task that already lives in the auto-scanned
 *    `tasks/` directory. Avalon only wires up the schedule.
 */

/**
 * Named cron aliases supported by croner / Nitro, in addition to standard
 * 5- or 6-field cron expressions.
 */
export const CRON_ALIASES = [
	"@yearly",
	"@annually",
	"@monthly",
	"@weekly",
	"@daily",
	"@midnight",
	"@hourly",
] as const;

/**
 * Validates a cron schedule string.
 *
 * Accepts either a named alias (e.g. `@daily`) or a standard cron expression
 * with 5 fields (minute hour day-of-month month day-of-week) or 6 fields
 * (with a leading seconds field). Each field may contain digits, `*`, `,`,
 * `-`, `/`, `?`, `L`, `W`, and `#` — the character set croner understands.
 */
export function isValidCronExpression(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed.length === 0) return false;

	if ((CRON_ALIASES as readonly string[]).includes(trimmed)) {
		return true;
	}

	const fields = trimmed.split(/\s+/);
	if (fields.length < 5 || fields.length > 6) return false;

	const fieldPattern = /^[0-9*,\-/?LW#]+$/i;
	return fields.every((field) => fieldPattern.test(field));
}

/**
 * Zod schema for a single cron schedule string.
 */
export const CronScheduleSchema = z
	.string()
	.min(1, "Cron schedule cannot be empty")
	.refine(isValidCronExpression, {
		message:
			"Invalid cron expression. Use a 5- or 6-field cron string (e.g. '0 0 * * *') or a named alias (e.g. '@daily').",
	});

/**
 * Zod schema for a single cron job definition.
 *
 * Exactly one of `handler` or `task` must be provided.
 */
export const CronJobSchema = z
	.object({
		/** Cron expression or named alias that determines when the job runs. */
		schedule: CronScheduleSchema,
		/**
		 * Path to the task handler file, relative to the project root
		 * (e.g. `"tasks/cleanup.ts"`). The file must default-export a task
		 * created with `defineCronJob` or Nitro's `defineTask`.
		 */
		handler: z.string().min(1).optional(),
		/**
		 * Name of a task defined in the auto-scanned `tasks/` directory.
		 * Use this instead of `handler` to schedule an already-discovered task.
		 */
		task: z.string().min(1).optional(),
		/**
		 * Explicit task name. Defaults to a name derived from the `handler`
		 * file path. Ignored when `task` is used.
		 */
		name: z
			.string()
			.min(1)
			.regex(
				/^[A-Za-z0-9_:.-]+$/,
				"Task name may only contain letters, numbers, and the characters _ : . -",
			)
			.optional(),
		/** Human-readable description shown in task listings. */
		description: z.string().optional(),
	})
	.refine((job) => Boolean(job.handler) !== Boolean(job.task), {
		message: "Each cron job must specify exactly one of 'handler' or 'task'.",
	});

/**
 * Zod schema for the full cron configuration: an array of cron jobs.
 */
export const CronConfigSchema = z.array(CronJobSchema);

/** A single cron job definition. */
export type CronJob = z.infer<typeof CronJobSchema>;

/** The full cron configuration passed to `nitro.cron`. */
export type CronConfig = z.infer<typeof CronConfigSchema>;
