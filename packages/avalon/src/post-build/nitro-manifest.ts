import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectFiles } from "./fs-utils.ts";

/**
 * Nitro's static asset manifest is emitted either minified with backtick
 * strings (`"/a.css":{type:\`text/css\`,...}`) or pretty-printed JSON
 * (`"/a.css": { "type": "text/css", ... }`), depending on the Nitro version.
 * Entries never nest objects, so a single `{ ... }` match covers one entry.
 */
const KEYED_OBJECT_RE = /"\/[^"\n]+":\s*\{[^{}]*\}/g;
const TYPE_FIELD_RE = /"?type"?\s*:/;

/** The first manifest entry in `code`: a path-keyed object with a `type` field. */
function findManifestEntry(code: string): { index: number; text: string } | undefined {
	for (const match of code.matchAll(KEYED_OBJECT_RE)) {
		if (TYPE_FIELD_RE.test(match[0])) return { index: match.index, text: match[0] };
	}
	return undefined;
}

type ManifestStyle = "compact" | "pretty";

export interface ManifestEntry {
	/** Public URL path, e.g. `/assets/ssr-index-abc.css`. */
	key: string;
	type: string;
	etag: string;
	size: number;
	/** `br`, `gzip`, `zstd`, or empty for the identity encoding. */
	encoding?: string;
}

function detectStyle(entry: string): ManifestStyle {
	return /"type"\s*:/.test(entry) ? "pretty" : "compact";
}

function indentOf(code: string, entryStart: number): string {
	const lineStart = code.lastIndexOf("\n", entryStart) + 1;
	return /^[\t ]*/.exec(code.slice(lineStart, entryStart))?.[0] ?? "";
}

/** Where public files sit relative to the server entry, unless the manifest says otherwise. */
const DEFAULT_PUBLIC_PREFIX = "../public";

/**
 * The directory prefix an existing entry uses for its `path`. An entry for `/assets/a.css` whose path
 * is `../public/assets/a.css` gives `../public`; the Netlify server bundle sits elsewhere and gives its
 * own prefix, so new entries resolve to the files next to the ones the server already serves.
 */
function publicPrefixOf(entryText: string): string {
	const key = /^"([^"]+)"/.exec(entryText)?.[1];
	const path = /"?path"?\s*:\s*[`"']([^`"']*)[`"']/.exec(entryText)?.[1];
	if (!key || !path?.endsWith(key)) return DEFAULT_PUBLIC_PREFIX;
	return path.slice(0, path.length - key.length);
}

function formatEntry(
	entry: ManifestEntry,
	style: ManifestStyle,
	indent: string,
	prefix: string,
): string {
	const mtime = new Date().toISOString();
	const path = `${prefix}${entry.key}`;
	if (style === "compact") {
		const encoding = entry.encoding ? `,encoding:\`${entry.encoding}\`` : "";
		return `"${entry.key}":{type:\`${entry.type}\`${encoding},etag:\`${entry.etag}\`,mtime:\`${mtime}\`,size:${entry.size},path:\`${path}\`}`;
	}
	const fields = [
		`"type": ${JSON.stringify(entry.type)}`,
		...(entry.encoding ? [`"encoding": ${JSON.stringify(entry.encoding)}`] : []),
		`"etag": ${JSON.stringify(entry.etag)}`,
		`"mtime": ${JSON.stringify(mtime)}`,
		`"size": ${entry.size}`,
		`"path": ${JSON.stringify(path)}`,
	];
	const inner = fields.map((f) => `${indent}\t${f}`).join(",\n");
	return `${JSON.stringify(entry.key)}: {\n${inner}\n${indent}}`;
}

/**
 * Adds entries the manifest does not already list, after an existing entry so
 * the new ones match its formatting. Returns the number of entries added, or 0
 * when the file has no recognisable manifest.
 */
export function addManifestEntries(serverEntry: string, entries: ManifestEntry[]): number {
	if (!existsSync(serverEntry) || entries.length === 0) return 0;

	const code = readFileSync(serverEntry, "utf-8");
	const anchor = findManifestEntry(code);
	if (!anchor) return 0;

	const missing = entries.filter((e) => !code.includes(`"${e.key}":`));
	if (missing.length === 0) return 0;

	const style = detectStyle(anchor.text);
	const indent = indentOf(code, anchor.index);
	// Pretty-printed manifests put each entry on its own line, indented like the anchor entry.
	const lineBreak = style === "pretty" ? `\n${indent}` : "";
	const prefix = publicPrefixOf(anchor.text);
	const joined = missing.map((e) => formatEntry(e, style, indent, prefix)).join(`,${lineBreak}`);
	const insertAt = anchor.index + anchor.text.length;
	const updated = `${code.slice(0, insertAt)},${lineBreak}${joined}${code.slice(insertAt)}`;
	writeFileSync(serverEntry, updated);
	return missing.length;
}

const COMPRESSED: Record<string, string> = { ".br": "br", ".gz": "gzip", ".zst": "zstd" };

/**
 * Builds manifest entries for files under `publicDir` that match `pick`,
 * including their `.br` / `.gz` / `.zst` siblings so Nitro can negotiate encoding.
 */
export function collectPublicEntries(
	publicDir: string,
	pick: (name: string) => boolean,
	type: string,
): ManifestEntry[] {
	const files = collectFiles(publicDir, (name) => {
		const base = name.replace(/\.(br|gz|zst)$/, "");
		return pick(base);
	});
	return files.map((file) => {
		const size = statSync(file).size;
		const ext = Object.keys(COMPRESSED).find((e) => file.endsWith(e));
		return {
			key: `/${file.substring(publicDir.length + 1).replaceAll("\\", "/")}`,
			type,
			etag: `"${size.toString(16)}-avalon"`,
			size,
			encoding: ext ? COMPRESSED[ext] : undefined,
		};
	});
}

/** A server bundle with an asset manifest, and the public folder that manifest describes. */
export interface ManifestTarget {
	publicDir: string;
	serverEntries: string[];
}

/** Every server bundle a build can produce, each paired with its own public folder. */
export function manifestTargets(cwd: string): ManifestTarget[] {
	const netlifyServer = join(cwd, ".netlify", "functions-internal", "server");
	return [
		{
			publicDir: join(cwd, ".output", "public"),
			serverEntries: [join(cwd, ".output", "server", "index.mjs")],
		},
		{
			publicDir: join(netlifyServer, "public"),
			serverEntries: [join(netlifyServer, "index.mjs"), join(netlifyServer, "main.mjs")],
		},
	];
}
