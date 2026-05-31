import { describe, expect, it } from "vitest";
import { isPreactComponent, normalizeProps } from "../server/utils.ts";

describe("normalizeProps", () => {
	describe("Requirement 4.3: converts class to className", () => {
		it("converts class to className when className is not present", () => {
			const props = { class: "btn primary", id: "submit" };
			const result = normalizeProps(props);
			expect(result).toEqual({ className: "btn primary", id: "submit" });
			expect(result).not.toHaveProperty("class");
		});

		it("does not overwrite existing className", () => {
			const props = { class: "old", className: "existing" };
			const result = normalizeProps(props);
			expect(result.className).toBe("existing");
			expect(result).toHaveProperty("class", "old");
		});

		it("handles empty class string", () => {
			const props = { class: "" };
			const result = normalizeProps(props);
			expect(result).toEqual({ className: "" });
			expect(result).not.toHaveProperty("class");
		});
	});

	describe("preserves other props unchanged", () => {
		it("returns props unchanged when no class key exists", () => {
			const props = { id: "root", title: "Hello", count: 42 };
			const result = normalizeProps(props);
			expect(result).toEqual({ id: "root", title: "Hello", count: 42 });
		});

		it("does not mutate the original props object", () => {
			const props = { class: "test", id: "el" };
			const original = { ...props };
			normalizeProps(props);
			expect(props).toEqual(original);
		});

		it("handles empty props", () => {
			expect(normalizeProps({})).toEqual({});
		});

		it("preserves nested object props", () => {
			const props = { style: { color: "red" }, data: [1, 2, 3] };
			const result = normalizeProps(props);
			expect(result).toEqual({ style: { color: "red" }, data: [1, 2, 3] });
		});
	});
});

describe("isPreactComponent", () => {
	it("returns true for .tsx files", () => {
		expect(isPreactComponent("Counter.tsx")).toBe(true);
	});

	it("returns true for .jsx files", () => {
		expect(isPreactComponent("Button.jsx")).toBe(true);
	});

	it("returns true for paths with directories", () => {
		expect(isPreactComponent("src/islands/Counter.tsx")).toBe(true);
		expect(isPreactComponent("/app/components/Nav.jsx")).toBe(true);
	});

	it("returns false for .ts files", () => {
		expect(isPreactComponent("utils.ts")).toBe(false);
	});

	it("returns false for .js files", () => {
		expect(isPreactComponent("index.js")).toBe(false);
	});

	it("returns false for .svelte files", () => {
		expect(isPreactComponent("App.svelte")).toBe(false);
	});

	it("returns false for .vue files", () => {
		expect(isPreactComponent("App.vue")).toBe(false);
	});

	it("returns false for paths without extensions", () => {
		expect(isPreactComponent("component")).toBe(false);
	});
});
