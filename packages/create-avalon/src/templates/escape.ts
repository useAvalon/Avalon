/** Escape a value embedded in generated single-quoted TS/JS string literals. */
export function escapeEmbeddedJsString(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("'", String.raw`\'`)
		.replaceAll("`", "\\`")
		.replaceAll("${", String.raw`\${`);
}
