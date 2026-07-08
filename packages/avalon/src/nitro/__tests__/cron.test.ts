import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isValidCronExpression } from "../../schemas/cron.ts";
import { ValidationError } from "../../schemas/index.ts";
import { deriveTaskName, resolveCronConfig } from "../cron.ts";

const ROOT = "/project";

describe("isValidCronExpression", () => {
	it("accepts standard 5-field expressions", () => {
		expect(isValidCronExpression("0 0 * * *")).toBe(true);
		expect(isValidCronExpression("*/5 * * * *")).toBe(true);
		expect(isValidCronExpression("0 9-17 * * 1-5")).toBe(true);
	});

	it("accepts 6-field (with seconds) expressions", () => {
		expect(isValidCronExpression("30 0 0 * * *")).toBe(true);
	});

	it("accepts named aliases", () => {
		expect(isValidCronExpression("@daily")).toBe(true);
		expect(isValidCronExpression("@hourly")).toBe(true);
	});

	it("rejects empty, malformed, or wrong-arity expressions", () => {
		expect(isValidCronExpression("")).toBe(false);
		expect(isValidCronExpression("nope")).toBe(false);
		expect(isValidCronExpression("* * *")).toBe(false);
		expect(isValidCronExpression("0 0 * * * * *")).toBe(false);
	});
});

describe("deriveTaskName", () => {
	it("mirrors Nitro naming for handlers inside the tasks/ dir", () => {
		expect(deriveTaskName("tasks/cleanup.ts", ROOT)).toBe("cleanup");
		expect(deriveTaskName("tasks/reports/digest.ts", ROOT)).toBe("reports:digest");
		expect(deriveTaskName("tasks/reports/index.ts", ROOT)).toBe("reports");
	});

	it("uses the base name for handlers outside the tasks/ dir", () => {
		expect(deriveTaskName("jobs/heartbeat.ts", ROOT)).toBe("heartbeat");
	});
});

describe("resolveCronConfig", () => {
	it("returns disabled config when no cron jobs are provided", () => {
		expect(resolveCronConfig(undefined, ROOT)).toEqual({
			experimentalTasks: false,
			tasks: {},
			scheduledTasks: {},
		});
		expect(resolveCronConfig([], ROOT).experimentalTasks).toBe(false);
	});

	it("registers a handler-based job as a task and schedules it", () => {
		const result = resolveCronConfig(
			[{ schedule: "0 * * * *", handler: "tasks/cleanup.ts" }],
			ROOT,
		);

		expect(result.experimentalTasks).toBe(true);
		expect(result.tasks).toEqual({
			cleanup: { handler: resolve(ROOT, "tasks/cleanup.ts"), description: "" },
		});
		expect(result.scheduledTasks).toEqual({ "0 * * * *": "cleanup" });
	});

	it("schedules a task-reference job without registering a handler", () => {
		const result = resolveCronConfig([{ schedule: "@daily", task: "reports:digest" }], ROOT);

		expect(result.tasks).toEqual({});
		expect(result.scheduledTasks).toEqual({ "@daily": "reports:digest" });
	});

	it("groups multiple jobs on the same schedule into an array", () => {
		const result = resolveCronConfig(
			[
				{ schedule: "@daily", task: "a" },
				{ schedule: "@daily", task: "b" },
			],
			ROOT,
		);

		expect(result.scheduledTasks).toEqual({ "@daily": ["a", "b"] });
	});

	it("honors an explicit name and description", () => {
		const result = resolveCronConfig(
			[{ schedule: "@hourly", handler: "jobs/hb.ts", name: "heartbeat", description: "ping" }],
			ROOT,
		);

		expect(result.tasks.heartbeat).toEqual({
			handler: resolve(ROOT, "jobs/hb.ts"),
			description: "ping",
		});
		expect(result.scheduledTasks).toEqual({ "@hourly": "heartbeat" });
	});

	it("throws when two handlers collide on the same task name", () => {
		expect(() =>
			resolveCronConfig(
				[
					{ schedule: "@daily", handler: "a/cleanup.ts" },
					{ schedule: "@hourly", handler: "b/cleanup.ts" },
				],
				ROOT,
			),
		).toThrow(/used by two different handlers/);
	});

	it("rejects a job with both handler and task", () => {
		expect(() =>
			resolveCronConfig(
				// biome-ignore lint/suspicious/noExplicitAny: intentionally invalid input
				[{ schedule: "@daily", handler: "tasks/x.ts", task: "x" } as any],
				ROOT,
			),
		).toThrow(ValidationError);
	});

	it("rejects an invalid cron expression", () => {
		expect(() => resolveCronConfig([{ schedule: "not-a-cron", task: "x" }], ROOT)).toThrow(
			ValidationError,
		);
	});
});
