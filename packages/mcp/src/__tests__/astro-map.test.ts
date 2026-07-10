import { describe, expect, it } from "vitest";
import {
	convertClientDirective,
	convertSnippet,
	lintForAstroisms,
} from "../knowledge/astro-map.ts";

describe("convertClientDirective", () => {
	it("maps client:load to on:client", () => {
		expect(convertClientDirective("client:load")).toBe("island={{ condition: 'on:client' }}");
	});

	it("maps client:visible to on:visible", () => {
		expect(convertClientDirective("client:visible")).toBe("island={{ condition: 'on:visible' }}");
	});

	it("maps client:idle to on:idle", () => {
		expect(convertClientDirective("client:idle")).toBe("island={{ condition: 'on:idle' }}");
	});

	it("maps client:only to on:client (Avalon always SSRs)", () => {
		expect(convertClientDirective('client:only="preact"')).toBe(
			"island={{ condition: 'on:client' }}",
		);
	});

	it("extracts the query from client:media", () => {
		expect(convertClientDirective('client:media={"(max-width: 600px)"}')).toBe(
			"island={{ condition: 'media:(max-width: 600px)' }}",
		);
	});
});

describe("convertSnippet", () => {
	it("rewrites every client:* directive in a block", () => {
		const input = "<A client:load />\n<B client:visible />";
		const out = convertSnippet(input);
		expect(out).toContain("island={{ condition: 'on:client' }}");
		expect(out).toContain("island={{ condition: 'on:visible' }}");
		expect(out).not.toContain("client:");
	});
});

describe("lintForAstroisms", () => {
	it("flags client:* directives with line numbers", () => {
		const findings = lintForAstroisms("<A foo />\n<B client:load />");
		expect(findings).toHaveLength(1);
		expect(findings[0].found).toBe("client:load");
		expect(findings[0].line).toBe(2);
	});

	it("flags Astro.* globals", () => {
		const findings = lintForAstroisms("const p = Astro.props;");
		expect(findings.some((f) => f.found === "Astro.props")).toBe(true);
	});

	it("flags astro:actions imports", () => {
		const findings = lintForAstroisms("import { defineAction } from 'astro:actions';");
		expect(findings.some((f) => f.suggestion.includes("@useavalon/avalon/actions"))).toBe(true);
	});

	it("flags .astro files and getStaticPaths", () => {
		const findings = lintForAstroisms(
			"import X from './Card.astro';\nexport function getStaticPaths() {}",
		);
		const found = findings.map((f) => f.found);
		expect(found.some((f) => f.includes(".astro"))).toBe(true);
		expect(found).toContain("getStaticPaths");
	});

	it("flags set:html and set:text directives", () => {
		const findings = lintForAstroisms("<div set:html={raw} />\n<span set:text={t} />");
		const found = findings.map((f) => f.found);
		expect(found).toContain("set:html");
		expect(found).toContain("set:text");
	});

	it("flags is:inline and define:vars directives", () => {
		const findings = lintForAstroisms("<script is:inline define:vars={{ x }}>");
		const found = findings.map((f) => f.found);
		expect(found).toContain("is:inline");
		expect(found).toContain("define:vars");
	});

	it("returns nothing for clean Avalon code", () => {
		const clean = "<Counter island={{ condition: 'on:visible' }} />";
		expect(lintForAstroisms(clean)).toHaveLength(0);
	});
});
