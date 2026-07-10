import { describe, expect, it } from "vitest";
import { applyShebang, stripShebang } from "../../scripts/normalize-shebang.ts";

const SHEBANG = "#!/usr/bin/env node";

describe("stripShebang", () => {
	it("removes a leading shebang line", () => {
		expect(stripShebang(`${SHEBANG}\nconst x = 1;`)).toBe("const x = 1;");
	});

	it("leaves code without a shebang unchanged", () => {
		expect(stripShebang("const x = 1;")).toBe("const x = 1;");
	});

	it("only removes the first line, not a '#!' appearing later", () => {
		const code = `const x = "#!/usr/bin/env node";`;
		expect(stripShebang(code)).toBe(code);
	});
});

describe("applyShebang (binary entry)", () => {
	it("adds a shebang when the source had none", () => {
		const out = applyShebang("const x = 1;", true);
		expect(out).toBe(`${SHEBANG}\nconst x = 1;`);
	});

	it("does not duplicate a shebang the minifier preserved", () => {
		const out = applyShebang(`${SHEBANG}\nconst x = 1;`, true);
		expect(out).toBe(`${SHEBANG}\nconst x = 1;`);
		// Regression guard: exactly one shebang, and it must be line 1.
		expect(out.match(/#!\/usr\/bin\/env node/g)).toHaveLength(1);
		expect(out.startsWith(`${SHEBANG}\n`)).toBe(true);
		expect(out.split("\n").indexOf(SHEBANG)).toBe(0);
	});
});

describe("applyShebang (non-binary files)", () => {
	it("never adds a shebang", () => {
		expect(applyShebang("const x = 1;", false)).toBe("const x = 1;");
	});

	it("strips a stray shebang", () => {
		expect(applyShebang(`${SHEBANG}\nconst x = 1;`, false)).toBe("const x = 1;");
	});
});
