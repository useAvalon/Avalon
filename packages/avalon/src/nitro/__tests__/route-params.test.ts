import { describe, expect, it } from "vitest";
import {
	extractParamsFromPattern,
	filePathToPattern,
	matchRoutePattern,
} from "../route-discovery.ts";

// These guard the dynamic-route param extraction that page rendering relies on.
// Regression: dynamic page routes (e.g. /projects/[id]) previously received an
// empty params object, so `params.id` was undefined ("Project not found").

describe("filePathToPattern → matchRoutePattern (dynamic page routes)", () => {
	it("maps [id].tsx to /:id and extracts the value", () => {
		const { pattern, params } = filePathToPattern("projects/[id].tsx");
		expect(pattern).toBe("/projects/:id");
		expect(params).toEqual(["id"]);

		const match = matchRoutePattern(pattern, "/projects/123");
		expect(match.matches).toBe(true);
		expect(match.params).toEqual({ id: "123" });
	});

	it("maps [...slug].tsx to a catch-all and captures the remainder", () => {
		const { pattern } = filePathToPattern("docs/[...slug].tsx");
		expect(pattern).toBe("/docs/**");

		const match = matchRoutePattern(pattern, "/docs/guides/getting-started");
		expect(match.matches).toBe(true);
		expect(match.params).toEqual({ slug: "guides/getting-started" });
	});

	it("extracts multiple named params", () => {
		const match = matchRoutePattern("/users/:id/posts/:postId", "/users/7/posts/99");
		expect(match.matches).toBe(true);
		expect(match.params).toEqual({ id: "7", postId: "99" });
	});
});

describe("matchRoutePattern (non-matches and statics)", () => {
	it("does not match when a required segment is missing", () => {
		expect(matchRoutePattern("/projects/:id", "/projects").matches).toBe(false);
	});

	it("does not match when there are extra segments", () => {
		expect(matchRoutePattern("/projects/:id", "/projects/1/2").matches).toBe(false);
	});

	it("matches a static route with no params", () => {
		const match = matchRoutePattern("/about", "/about");
		expect(match.matches).toBe(true);
		expect(match.params).toEqual({});
	});

	it("normalizes trailing slashes", () => {
		expect(matchRoutePattern("/projects/:id", "/projects/123/").params).toEqual({ id: "123" });
	});
});

describe("extractParamsFromPattern", () => {
	it("lists named params", () => {
		expect(extractParamsFromPattern("/users/:id/posts/:postId")).toEqual(["id", "postId"]);
	});

	it("represents a catch-all as slug", () => {
		expect(extractParamsFromPattern("/docs/**")).toEqual(["slug"]);
	});
});
