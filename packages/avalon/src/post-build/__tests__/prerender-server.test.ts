import { describe, expect, it } from "vitest";
import { isNetlifyHandler } from "../index.ts";

describe("isNetlifyHandler", () => {
	it("matches a Netlify functions path", () => {
		expect(isNetlifyHandler("/app/.netlify/functions-internal/server/server.mjs")).toBe(true);
		expect(isNetlifyHandler("C:\\app\\.netlify\\v1\\functions\\server\\server.mjs")).toBe(true);
	});

	it("does not treat a Cloudflare worker as Netlify when the bundle mentions netlify", () => {
		expect(isNetlifyHandler("/app/dist/_worker.js/index.js")).toBe(false);
	});
});
