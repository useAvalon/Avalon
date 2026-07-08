/**
 * Cron / scheduled task resolution for Avalon's Nitro integration.
 *
 * Translates Avalon's high-level `cron` config into the three pieces of native
 * Nitro configuration required to run scheduled tasks:
 *
 * - `experimental.tasks` — must be enabled for Nitro's task system.
 * - `tasks` — a map of task name -> `{ handler, description }`. Only jobs that
 *   provide an explicit `handler` file are registered here; jobs referencing an
 *   auto-scanned task by `name` rely on Nitro's `tasks/` directory scanning.
 * - `scheduledTasks` — a map of cron expression -> task name(s).
 *
 * Nitro then registers the correct scheduled runner for the active deployment
 * preset (e.g. the Vercel cron handler, Cloudflare triggers, or the in-process
 * scheduler used by the node-server preset).
 */

import { basename, isAbsolute, relative, resolve } from "node:path";
import { type CronConfig, CronConfigSchema, type CronJob } from "../schemas/cron.ts";
import { validate } from "../schemas/index.ts";

/**
 * The Nitro-native task configuration produced from an Avalon cron config.
 */
export interface ResolvedCronConfig {
	/** Whether Nitro's experimental task system must be enabled. */
	experimentalTasks: boolean;
	/** Nitro `tasks` map: task name -> handler/description. */
	tasks: Record<string, { handler?: string; description?: string }>;
	/** Nitro `scheduledTasks` map: cron expression -> task name(s). */
	scheduledTasks: Record<string, string | string[]>;
}

/**
 * Derives a Nitro task name from a handler file path.
 *
 * When the handler lives inside the project's `tasks/` directory, the name
 * mirrors Nitro's own scanning convention (path relative to `tasks/`, without
 * extension, with `/` replaced by `:`) so the two never register duplicates.
 * Otherwise the file's base name (without extension) is used.
 */
export function deriveTaskName(handlerPath: string, projectRoot: string): string {
	const absolute = isAbsolute(handlerPath) ? handlerPath : resolve(projectRoot, handlerPath);
	const tasksDir = resolve(projectRoot, "tasks");
	const rel = relative(tasksDir, absolute);

	// Inside the scanned tasks/ directory — mirror Nitro's naming.
	if (rel && !rel.startsWith("..") && !isAbsolute(rel)) {
		return rel
			.replace(/\.[A-Za-z]+$/, "")
			.replace(/\/index$/, "")
			.replace(/[/\\]/g, ":");
	}

	return basename(absolute).replace(/\.[A-Za-z]+$/, "");
}

/**
 * Adds a scheduled task entry, accumulating multiple task names under the same
 * cron expression into an array.
 */
function addScheduledTask(
	scheduledTasks: Record<string, string | string[]>,
	schedule: string,
	taskName: string,
): void {
	const existing = scheduledTasks[schedule];
	if (existing === undefined) {
		scheduledTasks[schedule] = taskName;
		return;
	}
	scheduledTasks[schedule] = Array.isArray(existing)
		? [...existing, taskName]
		: [existing, taskName];
}

/**
 * Validates and resolves an Avalon cron config into native Nitro task config.
 *
 * @param cron - The user-provided cron configuration (validated with Zod).
 * @param projectRoot - Absolute path to the project root, used to resolve
 *   handler file paths and derive task names.
 * @returns The resolved Nitro task configuration.
 * @throws {ValidationError} If the cron config fails schema validation.
 * @throws {Error} If two jobs resolve to the same task name with different handlers.
 */
export function resolveCronConfig(
	cron: CronConfig | undefined,
	projectRoot: string,
): ResolvedCronConfig {
	const empty: ResolvedCronConfig = {
		experimentalTasks: false,
		tasks: {},
		scheduledTasks: {},
	};

	if (!cron || cron.length === 0) {
		return empty;
	}

	const jobs = validate<CronConfig>(CronConfigSchema, cron, "Invalid cron configuration");

	const tasks: Record<string, { handler?: string; description?: string }> = {};
	const scheduledTasks: Record<string, string | string[]> = {};

	for (const job of jobs) {
		const taskName = resolveTaskName(job, projectRoot);

		// Register the handler when the job provides an explicit handler file.
		if (job.handler) {
			const handlerPath = isAbsolute(job.handler) ? job.handler : resolve(projectRoot, job.handler);

			const existing = tasks[taskName];
			if (existing?.handler && existing.handler !== handlerPath) {
				throw new Error(
					`Cron task name "${taskName}" is used by two different handlers ` +
						`("${existing.handler}" and "${handlerPath}"). ` +
						"Give one of the jobs an explicit, unique `name`.",
				);
			}

			tasks[taskName] = {
				handler: handlerPath,
				description: job.description ?? existing?.description ?? "",
			};
		}

		addScheduledTask(scheduledTasks, job.schedule.trim(), taskName);
	}

	return {
		experimentalTasks: true,
		tasks,
		scheduledTasks,
	};
}

/**
 * Resolves the task name for a job: an explicit `task` reference, an explicit
 * `name`, or a name derived from the `handler` path.
 */
function resolveTaskName(job: CronJob, projectRoot: string): string {
	if (job.task) return job.task;
	if (job.name) return job.name;
	if (job.handler) return deriveTaskName(job.handler, projectRoot);
	// Unreachable: schema guarantees handler or task is present.
	throw new Error("Cron job must specify either 'handler' or 'task'.");
}
