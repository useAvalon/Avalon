/** @jsxImportSource preact */

import { h } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import DocsSteps, { groupDocsSteps } from "../modules/docs/components/DocsSteps.tsx";

describe("DocsSteps", () => {
	it("groups one step per heading", () => {
		const groups = groupDocsSteps([
			h("h2", null, "Create a new project"),
			h("p", null, "Scaffold it."),
			h("h2", null, "Project setup"),
			h("p", null, "Install and run."),
		]);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toHaveLength(2);
		expect(groups[1]).toHaveLength(2);
	});

	it("renders numbered circles in markup", () => {
		const html = render(
			h(
				DocsSteps,
				null,
				h("h2", null, "Create a new project"),
				h("p", null, "Scaffold it."),
				h("h2", null, "Project setup"),
				h("p", null, "Install and run."),
			),
		);
		expect(html).toContain("docs-steps");
		expect(html).toContain("docs-step-num");
		expect(html).toContain(">1<");
		expect(html).toContain(">2<");
		expect(html.match(/class="[^"]*docs-step /g)?.length).toBe(2);
	});
});
