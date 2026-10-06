import hljs from "highlight.js";

/** Trusted static source only — same contract as CodeBlock dangerouslySetInnerHTML. */
export function highlightTrustedCode(source: string, language: string): string {
	const lang = /^[a-z0-9-]+$/i.test(language) ? language : "plaintext";
	if (hljs.getLanguage(lang)) {
		return hljs.highlight(source, { language: lang }).value;
	}
	return hljs.highlightAuto(source).value;
}
