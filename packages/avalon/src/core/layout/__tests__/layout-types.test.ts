import { describe, expect, it } from "vitest";
import type { LayoutFrontmatter } from "../layout-types.ts";

describe("LayoutFrontmatter", () => {
	it("types title and description as strings", () => {
		const frontmatter: LayoutFrontmatter = {
			title: "About",
			description: "The about route",
			currentPath: "/about",
		};
		const title: string = frontmatter.title ?? "";
		const description: string = frontmatter.description ?? "";
		expect(title).toBe("About");
		expect(description).toBe("The about route");
	});
});
