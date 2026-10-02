/**
 * Re-attach Vite's ignore comment on runtime dynamic imports.
 *
 * oxc-minify drops comments, so a source annotation does not survive into
 * dist. Vite then warns on every dynamic import it cannot analyze.
 * Static string and static template imports are left alone.
 */
export function preserveViteIgnore(code: string): string {
	let out = "";
	let cursor = 0;
	while (cursor < code.length) {
		const idx = code.indexOf("import(", cursor);
		if (idx === -1) {
			out += code.slice(cursor);
			break;
		}
		out += code.slice(cursor, idx);
		let arg = idx + "import(".length;
		while (code[arg] === " " || code[arg] === "\n" || code[arg] === "\t") arg++;
		if (shouldIgnore(code, arg)) {
			out += "import(/* @vite-ignore */ ";
		} else {
			out += "import(";
		}
		cursor = arg;
	}
	return out;
}

function shouldIgnore(code: string, arg: number): boolean {
	if (code.startsWith("/* @vite-ignore */", arg) || code.startsWith("/*@vite-ignore*/", arg)) {
		return false;
	}
	const quote = code[arg];
	if (quote === "'" || quote === '"') return false;
	if (quote === "`") return templateHasExpression(code, arg);
	return true;
}

/** True when a template literal starting at `backtick` interpolates a value. */
function templateHasExpression(code: string, backtick: number): boolean {
	for (let i = backtick + 1; i < code.length; i++) {
		const char = code[i];
		if (char === "\\") {
			i++;
			continue;
		}
		if (char === "`") return false;
		if (char === "$" && code[i + 1] === "{") return true;
	}
	return false;
}
