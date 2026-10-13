import { describe, expect, it } from "vitest";
import { SEO_ERROR_PAGE_PATH } from "../constants.ts";
import { htmlFileToPathname } from "../dist-transform.ts";

describe("htmlFileToPathname", () => {
	it("maps 404.html to the error-page sentinel", () => {
		expect(htmlFileToPathname("/dist", "/dist/404.html")).toBe(SEO_ERROR_PAGE_PATH);
	});

	it("maps index.html to /", () => {
		expect(htmlFileToPathname("/dist", "/dist/index.html")).toBe("/");
	});
});
