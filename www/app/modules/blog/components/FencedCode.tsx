import { highlightTrustedCode } from "../lib/highlight-code.ts";

interface FencedCodeProps {
	code: string;
	lang?: string;
}

export default function FencedCode({ code, lang = "text" }: Readonly<FencedCodeProps>) {
	const safeLang = /^[a-z0-9-]+$/i.test(lang) ? lang : "text";
	const html = highlightTrustedCode(code, safeLang);

	return (
		<pre>
			<code class={`hljs language-${safeLang}`} dangerouslySetInnerHTML={{ __html: html }} />
		</pre>
	);
}
