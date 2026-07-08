/**
 * Dev-mode cron scheduler.
 *
 * In production, cron jobs run through Nitro's native task scheduler (wired up
 * per deployment preset). But enabling Nitro's task system during `vite dev`
 * makes Nitro take over the SSR environment (swapping Avalon's runnable SSR for
 * a fetchable dev-worker), which changes rendering behavior. To keep dev SSR
 * owned by Avalon, we do NOT enable Nitro tasks in dev — instead this plugin
 * runs the configured jobs directly in the Vite process.
 *
 * Each second it checks every job's schedule and, on a match, loads the task
 * handler via Vite's SSR module loader and invokes its `run` function.
 */

import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { isRunnableDevEnvironment } from "vite";
import type { CronConfig } from "../schemas/cron.ts";
import { hasSecondsField, matchesCron } from "./matcher.ts";

interface DevJob {
	schedule: string;
	name: string;
	handlerPath: string;
	lastKey: number;
}

/** Resolves the handler file path for a job (explicit handler or tasks/<name>). */
function resolveHandlerPath(
	job: CronConfig[number],
	projectRoot: string,
): { name: string; handlerPath: string } | null {
	if (job.handler) {
		const handlerPath = isAbsolute(job.handler) ? job.handler : resolve(projectRoot, job.handler);
		const name = job.name ?? job.handler;
		return { name, handlerPath };
	}
	if (job.task) {
		// Best-effort mapping to a file in the scanned tasks/ directory.
		const rel = job.task.replaceAll(":", "/");
		return { name: job.task, handlerPath: resolve(projectRoot, "tasks", `${rel}.ts`) };
	}
	return null;
}

/**
 * Creates the dev-only cron scheduler plugin. No-op when `cron` is empty or
 * outside of `vite dev`.
 */
export function createCronDevSchedulerPlugin(
	cron: CronConfig | undefined,
	verbose = false,
): Plugin {
	return {
		name: "avalon:cron-dev-scheduler",
		apply: "serve",

		configureServer(server: ViteDevServer) {
			if (!cron || cron.length === 0) return;

			const projectRoot = server.config.root || process.cwd();
			const jobs: DevJob[] = [];
			for (const job of cron) {
				const resolved = resolveHandlerPath(job, projectRoot);
				if (resolved) {
					jobs.push({ schedule: job.schedule, ...resolved, lastKey: -1 });
				}
			}
			if (jobs.length === 0) return;

			const loadTask = async (handlerPath: string) => {
				// Prefer the runnable ssr environment's runner when available.
				// In Nitro-integrated setups the ssr environment is *fetchable*
				// (not runnable), so fall back to a direct dynamic import of the
				// handler file. Task handlers are plain server modules, so this is
				// safe and resolves their imports via the project's node_modules.
				const ssrEnv = server.environments?.ssr;
				if (ssrEnv && isRunnableDevEnvironment(ssrEnv)) {
					return await ssrEnv.runner.import(handlerPath);
				}
				return await import(/* @vite-ignore */ pathToFileURL(handlerPath).href);
			};

			const runHandler = async (job: DevJob) => {
				try {
					const mod = await loadTask(job.handlerPath);
					const task = mod?.default;
					if (!task || typeof task.run !== "function") {
						server.config.logger.warn(
							`[avalon:cron] Task "${job.name}" has no default export with a run() function.`,
						);
						return;
					}

					const outcome = await task.run({ payload: {}, context: {} });
					if (verbose) {
						server.config.logger.info(`[avalon:cron] Ran "${job.name}" (${job.schedule}).`);
					}
					// Broadcast the run over Vite's client channel so islands can
					// react live in dev without polling a server route. Handy for
					// demos and dev dashboards; production uses the deployed route.
					server.ws.send({
						type: "custom",
						event: "avalon:cron:run",
						data: {
							name: job.name,
							schedule: job.schedule,
							at: new Date().toISOString(),
							result: outcome?.result ?? null,
						},
					});
				} catch (error) {
					server.config.logger.error(
						`[avalon:cron] Job "${job.name}" (${job.schedule}) failed: ${
							error instanceof Error ? error.stack || error.message : String(error)
						}`,
					);
				}
			};

			const tick = () => {
				const now = new Date();
				for (const job of jobs) {
					if (!matchesCron(job.schedule, now)) continue;
					// De-dupe within the matching unit (second for 6-field, else minute).
					const key = hasSecondsField(job.schedule)
						? Math.floor(now.getTime() / 1000)
						: Math.floor(now.getTime() / 60000);
					if (key === job.lastKey) continue;
					job.lastKey = key;
					void runHandler(job);
				}
			};

			const timer = setInterval(tick, 1000);
			// Don't keep the dev process alive solely for the scheduler.
			if (typeof timer.unref === "function") timer.unref();

			server.httpServer?.once("close", () => clearInterval(timer));

			const jobList = jobs.map((j) => `${j.name} @ ${j.schedule}`).join(", ");
			const plural = jobs.length === 1 ? "" : "s";
			server.config.logger.info(
				`\n  ⏰ Avalon cron: scheduling ${jobs.length} dev job${plural} (${jobList})`,
			);
		},
	};
}
