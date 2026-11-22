/**
 * Precompiles server-side JSX into static templates.
 *
 * Preact normally builds a vnode for every element and walks the tree to render it. For markup
 * that never changes between requests that work is wasted. This transform rewrites host elements
 * into `jsxTemplate(strings, ...values)` calls: the static HTML becomes a constant array of strings
 * and only the dynamic parts are evaluated per request. Preact's string renderer understands those
 * vnodes natively, so components, hooks, context and async rendering behave as before and the
 * HTML is byte-identical.
 *
 * It only applies to server-rendered files. Templates cannot be rendered by Preact on the client.
 *
 * Elements stay normal JSX (and so stay inspectable through `props.children`) when they are:
 * - components, or JSX passed directly to a component as a child or prop value: written as is, in
 *   a conditional or logical expression, or in an array literal. JSX returned from a callback
 *   (for example `items.map(...)`) is compiled;
 * - elements with spread attributes, `dangerouslySetInnerHTML`, event handlers or other props
 *   with uppercase names (these keep Preact's own attribute handling);
 * - `svg` and `foreignObject`, which change how the renderer treats their descendants;
 * - `select`, `option`, `textarea` and `noscript`, which Preact renders specially.
 */

import { parseSync } from "oxc-parser";
import { jsxEscape } from "preact/jsx-runtime";
import { serializeAttribute } from "../render/attribute-serialize.ts";

/** Minimal shape of the ESTree/JSX nodes this transform reads. */
interface Node {
	type: string;
	start: number;
	end: number;
	// biome-ignore lint/suspicious/noExplicitAny: ESTree nodes are walked generically by key.
	[key: string]: any;
}

export interface PrecompileResult {
	code: string;
}

const RUNTIME_MODULE = "@useavalon/avalon/render/precompile-runtime";

const EXPRESSION_CONTAINER = "JSXExpressionContainer";
const EMPTY_EXPRESSION = "JSXEmptyExpression";
const JSX_ELEMENT = "JSXElement";
const JSX_FRAGMENT = "JSXFragment";
const JSX_ATTRIBUTE = "JSXAttribute";
const JSX_IDENTIFIER = "JSXIdentifier";

/** ESTree bookkeeping keys that never hold child nodes. */
const NODE_META_KEYS = new Set(["type", "start", "end"]);

const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/**
 * Elements Preact treats specially while rendering, so they must stay vnodes: form controls resolve
 * their `value` prop, `noscript` content is dropped or kept depending on the environment, and `svg`
 * and `foreignObject` switch the renderer between SVG and HTML mode for everything inside them.
 */
const KEPT_TAGS = new Set([
	"select",
	"option",
	"textarea",
	"optgroup",
	"noscript",
	"svg",
	"foreignObject",
]);

/** Props whose rendering `preact/compat` rewrites (`translate="no"` is dropped), so they stay vnodes. */
const KEPT_ATTRIBUTES = new Set(["translate"]);

const ATTRIBUTE_ALIASES: Record<string, string> = { className: "class", htmlFor: "for" };
const DROPPED_ATTRIBUTES = new Set(["key", "ref"]);

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: "\u00A0",
};

/**
 * Decodes the character references JSX allows in text and attribute strings. Only the common set is
 * handled; for anything else it returns null so the original JSX transform decodes the text instead.
 */
function decodeEntities(text: string): string | null {
	if (!text.includes("&")) return text;
	let supported = true;
	const decoded = text.replaceAll(
		/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
		(match, body: string) => {
			if (body.startsWith("#")) {
				const code =
					body[1] === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
				if (Number.isInteger(code) && code <= 0x10ffff) return String.fromCodePoint(code);
				supported = false;
				return match;
			}
			const named = NAMED_ENTITIES[body];
			if (named === undefined) supported = false;
			return named ?? match;
		},
	);
	return supported ? decoded : null;
}

/**
 * True when the element has content a template cannot reproduce exactly: a character reference we do
 * not decode, or a spread child (`{...items}`), which only the JSX transform can lower.
 */
function cannotReproduce(node: Node): boolean {
	for (const child of node.children ?? []) {
		if (child.type === "JSXSpreadChild") return true;
		if (child.type === "JSXText" && decodeEntities(child.value as string) === null) return true;
	}
	for (const attribute of node.openingElement?.attributes ?? []) {
		const value = attribute.type === JSX_ATTRIBUTE ? attribute.value : null;
		if (value?.type === "Literal" && typeof value.value === "string") {
			if (decodeEntities(value.value) === null) return true;
		}
	}
	return false;
}

/** Attribute names written exactly as given: plain lowercase HTML names, not event handlers. */
const PLAIN_ATTRIBUTE_NAME = /^[a-z][a-z0-9-]*$/;

/** Collects a template: static strings interleaved with dynamic expressions (as code). */
class TemplateBuilder {
	readonly segments: string[] = [""];
	readonly exprs: string[] = [];

	text(value: string): void {
		this.segments[this.segments.length - 1] += value;
	}

	dynamic(code: string): void {
		this.exprs.push(code);
		this.segments.push("");
	}
}

/**
 * A prefix for generated identifiers that appears nowhere in the module, so a helper or template
 * constant can never be shadowed or collide, whatever scope the source declares names in.
 */
function pickPrefix(code: string, identifiers: Set<string>): string {
	let prefix = "_$";
	const taken = () =>
		code.includes(prefix) || [...identifiers].some((name) => name.startsWith(prefix));
	while (taken()) prefix += "$";
	return prefix;
}

/** Every identifier name in the tree, decoded: `\\u005f$t` is `_$t` whatever the source text says. */
function collectIdentifierNames(node: Node, into: Set<string>): Set<string> {
	if (node.type === "Identifier" || node.type === JSX_IDENTIFIER) into.add(node.name as string);
	for (const child of childNodes(node)) collectIdentifierNames(child, into);
	return into;
}

class Compiler {
	private readonly names = new Map<string, string>();
	private readonly sources: string[] = [];
	private readonly prefix: string;

	constructor(
		private readonly code: string,
		program: Node,
	) {
		this.prefix = pickPrefix(code, collectIdentifierNames(program, new Set()));
	}

	/** Hoisted template constants, in declaration order. */
	declarations(): string {
		return this.sources
			.map((source, index) => `const ${this.prefix}tpl${index}=${source};`)
			.join("");
	}

	get usedTemplates(): boolean {
		return this.sources.length > 0;
	}

	private registerTemplate(segments: string[]): string {
		const source = JSON.stringify(segments);
		const existing = this.names.get(source);
		if (existing) return existing;
		const name = `${this.prefix}tpl${this.sources.length}`;
		this.names.set(source, name);
		this.sources.push(source);
		return name;
	}

	private emit(builder: TemplateBuilder): string {
		const name = this.registerTemplate(builder.segments);
		return `${this.prefix}t(${[name, ...builder.exprs].join(",")})`;
	}

	// ── source rewriting ─────────────────────────────────────────────────────

	/** Source text of `node` with every JSX root inside it compiled. */
	rewrite(node: Node): string {
		const edits: Edit[] = [];
		this.collectRoots(node, edits);
		return this.applyEdits(node.start, node.end, edits);
	}

	/** Source text of `[start, end)` with `edits` applied, keeping line numbers stable. */
	applyEdits(start: number, end: number, edits: Edit[]): string {
		edits.sort((a, b) => a.start - b.start);
		let out = "";
		let cursor = start;
		for (const edit of edits) {
			out += this.code.slice(cursor, edit.start);
			out += edit.text;
			const removed = this.code.slice(edit.start, edit.end);
			out += "\n".repeat(Math.max(0, countNewlines(removed) - countNewlines(edit.text)));
			cursor = edit.end;
		}
		return out + this.code.slice(cursor, end);
	}

	/** Finds the outermost JSX nodes under `node` and records an edit for each. */
	private collectRoots(node: Node, edits: Edit[]): void {
		if (isJsxRoot(node)) {
			edits.push({ start: node.start, end: node.end, text: this.compileRoot(node) });
			return;
		}
		for (const child of childNodes(node)) this.collectRoots(child, edits);
	}

	// ── JSX compilation ──────────────────────────────────────────────────────

	/** Compiles a JSX element or fragment found in an expression position. */
	compileRoot(node: Node): string {
		if (node.type === JSX_FRAGMENT && !cannotReproduce(node)) {
			const builder = new TemplateBuilder();
			this.addChildren(builder, node.children);
			return this.emit(builder);
		}
		if (this.isCompilableHost(node)) {
			const builder = new TemplateBuilder();
			this.addHost(builder, node);
			return this.emit(builder);
		}
		return this.keep(node);
	}

	/**
	 * Keeps an element as JSX, with the code inside its props and children rewritten. Direct
	 * children of a component stay elements so the component can inspect them.
	 */
	private keep(node: Node): string {
		if (node.type === JSX_FRAGMENT) {
			return this.keepWithChildren(node, false);
		}
		return this.keepWithChildren(node, isComponent(node));
	}

	private keepWithChildren(node: Node, parentIsComponent: boolean): string {
		const edits: Edit[] = [];
		if (node.openingElement) {
			this.collectAttributeEdits(node.openingElement.attributes, parentIsComponent, edits);
		}
		this.collectChildEdits(node.children, parentIsComponent, edits);
		return this.applyEdits(node.start, node.end, edits);
	}

	/** An edit that replaces `expression` with its own rewritten source. */
	private rewriteEdit(expression: Node, inspectable: boolean): Edit {
		const text = inspectable ? this.rewriteInspectable(expression) : this.rewrite(expression);
		return { start: expression.start, end: expression.end, text };
	}

	/**
	 * Rewrites an expression whose value is handed straight to a component. JSX that is the value
	 * itself, a branch of a conditional or logical expression, or an array element stays an element,
	 * so the component can still inspect it; JSX anywhere else (a callback body, a call argument) is
	 * compiled as usual.
	 */
	private rewriteInspectable(expression: Node): string {
		const edits: Edit[] = [];
		this.collectInspectable(expression, edits);
		return this.applyEdits(expression.start, expression.end, edits);
	}

	private collectInspectable(node: Node, edits: Edit[]): void {
		if (isJsxRoot(node)) {
			edits.push({ start: node.start, end: node.end, text: this.keep(node) });
			return;
		}
		switch (node.type) {
			case "ConditionalExpression":
				this.collectRoots(node.test, edits);
				this.collectInspectable(node.consequent, edits);
				this.collectInspectable(node.alternate, edits);
				return;
			case "LogicalExpression":
				// `a || b` and `a ?? b` can hand either side to the component; `a && b` only the right.
				if (node.operator === "&&") this.collectRoots(node.left, edits);
				else this.collectInspectable(node.left, edits);
				this.collectInspectable(node.right, edits);
				return;
			case "ArrayExpression":
				for (const element of node.elements) if (element) this.collectInspectable(element, edits);
				return;
			case "ParenthesizedExpression":
			case "TSAsExpression":
			case "TSSatisfiesExpression":
			case "TSNonNullExpression":
				this.collectInspectable(node.expression, edits);
				return;
			default:
				this.collectRoots(node, edits);
		}
	}

	/** Rewrites the JSX nested in attribute values and spreads of a kept element. */
	private collectAttributeEdits(
		attributes: Node[],
		parentIsComponent: boolean,
		edits: Edit[],
	): void {
		for (const attribute of attributes) {
			if (attribute.type === "JSXSpreadAttribute") {
				edits.push(this.rewriteEdit(attribute.argument, false));
				continue;
			}
			const value = attribute.value;
			if (!value) continue;
			if (value.type === EXPRESSION_CONTAINER) {
				if (value.expression.type !== EMPTY_EXPRESSION) {
					edits.push(this.rewriteEdit(value.expression, parentIsComponent));
				}
			} else if (isJsxRoot(value)) {
				edits.push({ start: value.start, end: value.end, text: this.keep(value) });
			}
		}
	}

	/** Rewrites the children of a kept element: expressions in place, elements per the parent's kind. */
	private collectChildEdits(children: Node[], parentIsComponent: boolean, edits: Edit[]): void {
		for (const child of children) {
			if (child.type === EXPRESSION_CONTAINER) {
				if (child.expression.type !== EMPTY_EXPRESSION) {
					edits.push(this.rewriteEdit(child.expression, parentIsComponent));
				}
			} else if (isJsxRoot(child)) {
				const text = parentIsComponent ? this.keep(child) : `{${this.compileRoot(child)}}`;
				edits.push({ start: child.start, end: child.end, text });
			}
		}
	}

	private isCompilableHost(node: Node): boolean {
		if (node.type !== JSX_ELEMENT || isComponent(node)) return false;
		const name = node.openingElement.name;
		if (name.type !== JSX_IDENTIFIER || KEPT_TAGS.has(name.name)) return false;
		const attributes: Node[] = node.openingElement.attributes;
		if (!attributes.every(isCompilableAttribute) || cannotReproduce(node)) return false;
		// Both spellings of one attribute (`class` and `className`, `for` and `htmlFor`): Preact picks
		// one by rule, which is not worth reproducing.
		const names = attributes.map((attribute) => attribute.name.name as string);
		return !Object.entries(ATTRIBUTE_ALIASES).some(
			([alias, target]) => names.includes(alias) && names.includes(target),
		);
	}

	private addHost(builder: TemplateBuilder, node: Node): void {
		const tag = node.openingElement.name.name as string;
		builder.text(`<${tag}`);
		for (const attribute of node.openingElement.attributes) {
			this.addAttribute(builder, attribute);
		}
		if (VOID_ELEMENTS.has(tag)) {
			builder.text("/>");
			return;
		}
		builder.text(">");
		this.addChildren(builder, node.children);
		builder.text(`</${tag}>`);
	}

	private addAttribute(builder: TemplateBuilder, attribute: Node): void {
		const rawName = attribute.name.name as string;
		const value = attribute.value;
		if (DROPPED_ATTRIBUTES.has(rawName)) {
			this.addDroppedAttribute(builder, value);
			return;
		}
		const name = ATTRIBUTE_ALIASES[rawName] ?? rawName;

		if (!value) {
			builder.text(serializeAttribute(name, true));
			return;
		}
		if (value.type === "Literal") {
			// A JSX attribute string: character references are decoded, backslashes are not escapes.
			builder.text(serializeAttribute(name, decodeEntities(String(value.value)) ?? ""));
			return;
		}
		if (value.expression.type === EMPTY_EXPRESSION) return;
		const constant = staticValue(value.expression);
		if (constant !== undefined) {
			builder.text(serializeAttribute(name, constant.value));
			return;
		}
		builder.dynamic(`${this.prefix}a(${JSON.stringify(name)},${this.rewrite(value.expression)})`);
	}

	/**
	 * `key` and `ref` never reach the HTML, but an expression that calls something (`key={next()}`,
	 * `ref={useRef()}`) must still run, in source order. Pure expressions are simply dropped.
	 */
	private addDroppedAttribute(builder: TemplateBuilder, value: Node | null): void {
		if (value?.type !== EXPRESSION_CONTAINER || value.expression.type === EMPTY_EXPRESSION) return;
		if (!mayHaveSideEffects(value.expression)) return;
		builder.dynamic(`${this.prefix}d(${this.rewrite(value.expression)})`);
	}

	private addChildren(builder: TemplateBuilder, children: Node[]): void {
		for (const child of children) {
			switch (child.type) {
				case "JSXText": {
					// Whitespace rules apply to the source text, so `&#10;` stays a real newline.
					const text = decodeEntities(cleanJsxText(child.value as string)) ?? "";
					if (text) builder.text(String(jsxEscape(text)));
					break;
				}
				case EXPRESSION_CONTAINER:
					this.addExpression(builder, child.expression);
					break;
				case JSX_FRAGMENT:
					if (cannotReproduce(child)) builder.dynamic(this.keep(child));
					else this.addChildren(builder, child.children);
					break;
				case JSX_ELEMENT:
					this.addChildElement(builder, child);
					break;
				default:
					builder.dynamic(this.code.slice(child.start, child.end));
			}
		}
	}

	/** Inlines a host child into the template, or keeps it as JSX when it cannot be reproduced exactly. */
	private addChildElement(builder: TemplateBuilder, child: Node): void {
		if (this.isCompilableHost(child)) this.addHost(builder, child);
		else builder.dynamic(this.keep(child));
	}

	private addExpression(builder: TemplateBuilder, expression: Node): void {
		if (expression.type === EMPTY_EXPRESSION) return;
		const constant = staticValue(expression);
		if (constant !== undefined) {
			const value = constant.value;
			if (value !== null && typeof value !== "boolean") builder.text(String(jsxEscape(value)));
			return;
		}
		if (isJsxRoot(expression)) {
			builder.dynamic(this.compileRoot(expression));
			return;
		}
		builder.dynamic(`${this.prefix}c(${this.rewrite(expression)})`);
	}

	/** Import and constants to place at the top of the file. */
	header(): string {
		const p = this.prefix;
		const imports = `jsxTemplate as ${p}t,child as ${p}c,attr as ${p}a,discard as ${p}d`;
		return `import{${imports}}from${JSON.stringify(RUNTIME_MODULE)};${this.declarations()}`;
	}
}

interface Edit {
	start: number;
	end: number;
	text: string;
}

/** The AST nodes directly under `node`, in source order of its keys. */
function* childNodes(node: Node): Generator<Node> {
	for (const key of Object.keys(node)) {
		if (NODE_META_KEYS.has(key)) continue;
		const value = node[key];
		if (Array.isArray(value)) {
			for (const item of value) if (isNode(item)) yield item;
		} else if (isNode(value)) {
			yield value;
		}
	}
}

/** Whether an attribute can be baked into a template with output identical to Preact's. */
function isCompilableAttribute(attribute: Node): boolean {
	if (attribute.type !== JSX_ATTRIBUTE || attribute.name.type !== JSX_IDENTIFIER) return false;
	const attributeName = attribute.name.name as string;
	if (attributeName === "key") return !hasCalls(attribute.value);
	if (DROPPED_ATTRIBUTES.has(attributeName)) return true;
	if (attributeName === "children" || attributeName === "dangerouslySetInnerHTML") return false;
	if (KEPT_ATTRIBUTES.has(attributeName)) return false;
	const mapped = ATTRIBUTE_ALIASES[attributeName] ?? attributeName;
	// Anything but a plain lowercase name (event handlers, camelCase props, `on*`) keeps Preact's own handling.
	if (!PLAIN_ATTRIBUTE_NAME.test(mapped) || mapped.startsWith("on")) return false;
	// The one lowercase name the renderer rewrites (`panose-1`) inside SVG.
	if (mapped === "panose1") return false;
	return isCompilableValue(mapped, attribute.value);
}

function isCompilableValue(name: string, value: Node | null): boolean {
	if (!value) return true;
	if (value.type !== "Literal" && value.type !== EXPRESSION_CONTAINER) return false;
	// Preact turns style objects into CSS (adding `px` to numbers); only literal strings are safe to bake.
	const dynamicStyle =
		name === "style" && value.type === EXPRESSION_CONTAINER && !staticValue(value.expression);
	return !dynamicStyle;
}

function isNode(value: unknown): value is Node {
	return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function isJsxRoot(node: Node): boolean {
	return node.type === JSX_ELEMENT || node.type === JSX_FRAGMENT;
}

/**
 * Same rule as the JSX transform: a tag is a host element only when its name starts with an ASCII
 * lowercase letter or contains a hyphen. Every other name (`Card`, `_card`, `$card`, `Écran`) is a
 * reference to a component, as are member expressions (`Foo.Bar`).
 */
function isComponent(node: Node): boolean {
	const name = node.openingElement?.name;
	if (!name) return false;
	if (name.type === "JSXMemberExpression") return true;
	if (name.type === "JSXNamespacedName") return false;
	const text = name.name as string;
	return !/^[a-z]/.test(text) && !text.includes("-");
}

const SIDE_EFFECT_NODES = new Set([
	"CallExpression",
	"NewExpression",
	"AssignmentExpression",
	"UpdateExpression",
	"AwaitExpression",
	"YieldExpression",
	"TaggedTemplateExpression",
	"ImportExpression",
]);

/**
 * The automatic JSX runtime evaluates `key` after the props and children. A template runs it in
 * source position, so an element whose key calls something stays JSX to keep that order.
 */
function hasCalls(value: Node | null): boolean {
	return value?.type === EXPRESSION_CONTAINER && mayHaveSideEffects(value.expression);
}

const FUNCTION_NODES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

/** Whether evaluating `node` can do more than read values. Function bodies only run when called. */
function mayHaveSideEffects(node: Node): boolean {
	if (SIDE_EFFECT_NODES.has(node.type)) return true;
	if (FUNCTION_NODES.has(node.type)) return false;
	for (const child of childNodes(node)) if (mayHaveSideEffects(child)) return true;
	return false;
}

/** A literal whose value is known at compile time (string, number, boolean, plain template). */
function staticValue(node: Node): { value: string | number | boolean | null } | undefined {
	if (node.type === "Literal") {
		const value = node.value;
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			return { value };
		}
		if (value === null && node.raw === "null") return { value: null };
		return undefined;
	}
	if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
		return { value: node.quasis[0].value.cooked as string };
	}
	return undefined;
}

/** JSX text whitespace rules: trim line edges, drop empty lines, join the rest with spaces. */
function cleanJsxText(text: string): string {
	const lines = text.split(/\r\n|\n|\r/);
	let lastNonEmpty = 0;
	for (let i = 0; i < lines.length; i++) {
		if (/[^ \t]/.test(lines[i] as string)) lastNonEmpty = i;
	}
	let result = "";
	for (let i = 0; i < lines.length; i++) {
		let line = (lines[i] as string).replaceAll("\t", " ");
		if (i !== 0) line = line.replace(/^ +/, "");
		if (i !== lines.length - 1) line = line.replace(/ +$/, "");
		if (!line) continue;
		if (i !== lastNonEmpty) line += " ";
		result += line;
	}
	return result;
}

function countNewlines(text: string): number {
	let count = 0;
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;
	return count;
}

/** Any `@jsx*` pragma other than `@jsxImportSource preact` selects a runtime the templates bypass. */
function hasCustomJsxPragma(comments: Array<{ value: string }>): boolean {
	return comments.some((comment) =>
		[...comment.value.matchAll(/@jsx\w*\s*(\S*)/g)].some(
			(m) => !m[0].startsWith("@jsxImportSource") || m[1] !== "preact",
		),
	);
}

/**
 * Where to insert the header: after a hashbang, directives such as `"use strict"`, and the
 * `@jsxImportSource` pragma comment, which the JSX transform only reads before the first statement.
 */
function headerPosition(program: Node, comments: Array<{ value: string; end: number }>): number {
	let end = program.hashbang?.end ?? 0;
	let firstStatement = Number.POSITIVE_INFINITY;
	for (const statement of program.body as Node[]) {
		firstStatement = Math.min(firstStatement, statement.start);
		if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") break;
		end = statement.end;
	}
	for (const comment of comments) {
		if (comment.end <= firstStatement && comment.value.includes("@jsxImportSource")) {
			end = Math.max(end, comment.end);
		}
	}
	return end;
}

/**
 * Rewrites the JSX in `code` to precompiled templates. Returns null when the file has no JSX to
 * rewrite, cannot be parsed or selects its own JSX runtime with a pragma, so the normal transform
 * handles it.
 */
export function precompileJsx(code: string, filename: string): PrecompileResult | null {
	if (!code.includes("<")) return null;
	const parsed = parseSync(filename, code, { lang: "tsx" });
	if (parsed.errors.length > 0 || hasCustomJsxPragma(parsed.comments)) return null;

	const program = parsed.program as unknown as Node;
	const compiler = new Compiler(code, program);
	const rewritten = compiler.rewrite(program);
	if (!compiler.usedTemplates) return null;

	const at = headerPosition(program, parsed.comments);
	return { code: rewritten.slice(0, at) + compiler.header() + rewritten.slice(at) };
}
