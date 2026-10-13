import type { SeoConfig } from "./config.ts";
import { transformSeoHtml } from "./transform.ts";

function appendChunk(chunks: Buffer[], chunk: unknown, encodingOrCb: unknown): void {
	if (!chunk) return;
	if (Buffer.isBuffer(chunk)) {
		chunks.push(chunk);
		return;
	}
	if (chunk instanceof Uint8Array) {
		chunks.push(Buffer.from(chunk));
		return;
	}
	if (typeof chunk === "string") {
		const encoding = typeof encodingOrCb === "string" ? (encodingOrCb as BufferEncoding) : "utf-8";
		chunks.push(Buffer.from(chunk, encoding));
	}
}

export function patchResponseForSeo(
	res: import("node:http").ServerResponse,
	url: string,
	config: SeoConfig,
): void {
	const originalEnd = res.end.bind(res);
	const originalWrite = res.write.bind(res);
	const originalSetHeader = res.setHeader.bind(res);
	const originalWriteHead = res.writeHead.bind(res);
	const chunks: Buffer[] = [];
	let intercepting = false;

	const markAsIntercepting = () => {
		intercepting = true;
	};

	res.setHeader = ((name: string, value: unknown): unknown => {
		if (
			name.toLowerCase() === "content-type" &&
			typeof value === "string" &&
			value.includes("text/html")
		) {
			markAsIntercepting();
		}
		return originalSetHeader(name, value);
	}) as typeof res.setHeader;

	res.writeHead = ((statusCode: number, ...rest: unknown[]): unknown => {
		for (const arg of rest) {
			if (arg && typeof arg === "object" && !Array.isArray(arg)) {
				for (const [key, val] of Object.entries(arg)) {
					if (
						key.toLowerCase() === "content-type" &&
						typeof val === "string" &&
						val.includes("text/html")
					) {
						markAsIntercepting();
					}
				}
			}
		}
		return originalWriteHead(statusCode, ...rest);
	}) as typeof res.writeHead;

	res.write = ((chunk: unknown, encodingOrCb?: unknown, cb?: unknown): boolean => {
		if (!intercepting) {
			return originalWrite(chunk as never, encodingOrCb as never, cb as never);
		}
		appendChunk(chunks, chunk, encodingOrCb);
		if (typeof encodingOrCb === "function") {
			(encodingOrCb as () => void)();
		} else if (typeof cb === "function") {
			(cb as () => void)();
		}
		return true;
	}) as typeof res.write;

	res.end = ((chunk?: unknown, encodingOrCb?: unknown, cb?: unknown): unknown => {
		if (!intercepting) {
			const ct = res.getHeader("content-type");
			if (typeof ct === "string" && ct.includes("text/html")) {
				markAsIntercepting();
			}
		}

		if (!intercepting) {
			return originalEnd(chunk as never, encodingOrCb as never, cb as never);
		}

		appendChunk(chunks, chunk, encodingOrCb);

		if (chunks.length === 0) {
			return originalEnd(chunk as never, encodingOrCb as never, cb as never);
		}

		const html = Buffer.concat(chunks).toString("utf-8");
		const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb;

		const finalHtml = transformSeoHtml(html, url, config);
		if (finalHtml !== html) {
			originalSetHeader("Content-Length", String(Buffer.byteLength(finalHtml)));
		}
		return originalEnd(finalHtml, "utf-8", callback as (() => void) | undefined);
	}) as typeof res.end;
}
