/**
 * Runtime helpers for authoring Avalon cron jobs.
 *
 * A cron job is just a Nitro task with a run function. Drop a file in your
 * project's `tasks/` directory (auto-discovered by Nitro) or point a `cron`
 * config entry at it via its `handler` path, then default-export the result of
 * `defineCronJob`.
 *
 * @example
 * ```ts
 * // tasks/cleanup.ts
 * import { defineCronJob } from "@useavalon/avalon/cron";
 *
 * export default defineCronJob({
 *   meta: { description: "Purge expired sessions" },
 *   async run({ payload }) {
 *     await db.sessions.deleteExpired();
 *     return { result: "ok" };
 *   },
 * });
 * ```
 *
 * Then schedule it in your Vite config:
 *
 * ```ts
 * avalon({
 *   nitro: {
 *     cron: [{ schedule: "0 * * * *", handler: "tasks/cleanup.ts" }],
 *   },
 * });
 * ```
 */

import { defineTask, runTask } from "nitro/task";
import type { Task, TaskContext, TaskPayload, TaskResult } from "nitro/types";

/**
 * Defines a cron job (a Nitro task) with a strongly-typed run function.
 *
 * This is a thin, semantically-named wrapper over Nitro's `defineTask` so cron
 * handler files read clearly. The returned value must be the file's default
 * export so Nitro can discover and run it.
 *
 * @typeParam RT - The type of the value returned by the task's `run` function.
 * @param definition - The task definition (`meta` + `run`).
 * @returns The Nitro task, ready to be default-exported.
 */
export function defineCronJob<RT = unknown>(definition: Task<RT>): Task<RT> {
	return defineTask<RT>(definition);
}

/**
 * Manually triggers a registered cron job / task by name.
 *
 * Useful for running a scheduled job on demand (e.g. from an API route or a
 * test) without waiting for its schedule.
 *
 * @param name - The task name (as registered / derived from its handler path).
 * @param options - Optional payload and context passed to the task's `run`.
 * @returns The task result.
 */
export function runCronJob<RT = unknown>(
	name: string,
	options?: { payload?: TaskPayload; context?: TaskContext },
): Promise<TaskResult<RT>> {
	return runTask<RT>(name, options);
}

export type { Task, TaskContext, TaskPayload, TaskResult } from "nitro/types";
