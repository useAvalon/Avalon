/**
 * Makes injected `await __pageRenderIsland(...)` calls legal and resolvable
 * during SSR.
 *
 * Parses the page/layout TSX with oxc-parser, then applies source edits:
 * enclosing functions become `async`, `.map`/`.flatMap` callbacks are wrapped
 * in `await Promise.all(...)`, and local helper JSX (`<Card />`) becomes
 * `await Card(...)`.
 *
 * JavaScript forbids `await` in a sync function, so the pre-edit source cannot
 * be parsed as-is. Awaits are masked to `void ` (same length, offsets stay
 * aligned) and matched back to the original tokens.
 */

import { parseSync, visitorKeys } from "oxc-parser";

interface Node {
	type: string;
	start: number;
	end: number;
	[key: string]: unknown;
}

interface Edit {
	start: number;
	end: number;
	text: string;
}

const FUNCTION_TYPES = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression",
]);

function isNode(value: unknown): value is Node {
	return Boolean(value) && typeof value === "object" && typeof (value as Node).type === "string";
}

function unwrap(node: Node): Node {
	let current = node;
	while (current.type === "ParenthesizedExpression" && isNode(current.expression)) {
		current = current.expression;
	}
	return current;
}

function* childrenOf(node: Node): Generator<Node> {
	const keys = visitorKeys[node.type];
	if (!keys) return;
	for (const key of keys) {
		const value = node[key];
		if (Array.isArray(value)) {
			for (const item of value) {
				if (isNode(item)) yield item;
			}
		} else if (isNode(value)) {
			yield value;
		}
	}
}

/** Depth-first walk that yields each node with its ancestor chain (root → parent). */
function* walk(root: Node): Generator<{ node: Node; ancestors: Node[] }> {
	const ancestors: Node[] = [];
	function* visit(node: Node): Generator<{ node: Node; ancestors: Node[] }> {
		yield { node, ancestors };
		ancestors.push(node);
		for (const child of childrenOf(node)) yield* visit(child);
		ancestors.pop();
	}
	yield* visit(root);
}

function parseTsx(code: string, fileId: string): Node {
	const filename = fileId.endsWith(".jsx") ? "page.jsx" : "page.tsx";
	// `await` is 5 chars; `void ` is 5 chars. Offsets stay aligned with `code`.
	const masked = code.replace(/\bawait\b/g, "void ");
	const result = parseSync(filename, masked, {
		lang: fileId.endsWith(".jsx") ? "jsx" : "tsx",
		range: true,
	});
	if (result.errors.length > 0) {
		const first = result.errors[0];
		throw new Error(`[avalon] failed to parse ${fileId} after island transform: ${first.message}`);
	}
	return result.program as unknown as Node;
}

/** True when this `void expr` is the mask for an `await expr` in the original source. */
function isMaskedAwait(node: Node, original: string): boolean {
	return (
		node.type === "UnaryExpression" &&
		node.operator === "void" &&
		original.startsWith("await", node.start)
	);
}

function lineAt(code: string, pos: number): number {
	let line = 1;
	for (let i = 0; i < pos && i < code.length; i++) {
		if (code[i] === "\n") line++;
	}
	return line;
}

function identName(node: unknown): string | null {
	return isNode(node) && node.type === "Identifier" && typeof node.name === "string"
		? node.name
		: null;
}

function functionName(fn: Node, parent: Node | null): string | null {
	const declared = identName(fn.id);
	if (declared) return declared;
	if (parent?.type === "VariableDeclarator") return identName(parent.id);
	if (parent?.type === "AssignmentExpression") return identName(parent.left);
	return null;
}

function innermostFunction(ancestors: Node[]): { fn: Node; parent: Node | null } | null {
	for (let i = ancestors.length - 1; i >= 0; i--) {
		if (FUNCTION_TYPES.has(ancestors[i].type)) {
			return { fn: ancestors[i], parent: i > 0 ? ancestors[i - 1] : null };
		}
	}
	return null;
}

function isMethodParent(parent: Node | null): boolean {
	if (!parent) return false;
	if (parent.type === "MethodDefinition") return true;
	if (parent.type === "Property" && parent.method === true) return true;
	return false;
}

function defaultExportNames(program: Node): Set<string> {
	const names = new Set<string>();
	for (const { node } of walk(program)) {
		if (node.type !== "ExportDefaultDeclaration" || !isNode(node.declaration)) continue;
		const decl = node.declaration;
		const named = identName(decl) ?? identName(decl.id);
		if (named) names.add(named);
	}
	return names;
}

function throwUnrewritable(kind: string, fileId: string, code: string, pos: number): never {
	const line = lineAt(code, pos);
	throw new Error(
		`[avalon] island at ${fileId}:${line} sits inside a ${kind} that cannot be marked async. ` +
			"Move it into the page default export, a nested function, or a .map() callback.",
	);
}

function collectFunctionsNeedingAsync(program: Node, fileId: string, code: string): Set<Node> {
	const needsAsync = new Set<Node>();

	for (const { node, ancestors } of walk(program)) {
		if (isMaskedAwait(node, code)) {
			const enclosing = innermostFunction(ancestors);
			if (!enclosing) continue;
			if (isMethodParent(enclosing.parent)) {
				throwUnrewritable("method", fileId, code, node.start);
			}
			if (enclosing.fn.generator === true) {
				throwUnrewritable("generator", fileId, code, node.start);
			}
			needsAsync.add(enclosing.fn);
		}
	}

	return needsAsync;
}

function jsxUsagesByTag(program: Node): Map<string, Array<{ ancestors: Node[] }>> {
	const jsxByTag = new Map<string, Array<{ ancestors: Node[] }>>();
	for (const { node, ancestors } of walk(program)) {
		if (node.type !== "JSXElement") continue;
		const tag = jsxTagName(node);
		if (!tag) continue;
		const list = jsxByTag.get(tag) ?? [];
		list.push({ ancestors: ancestors.slice() });
		jsxByTag.set(tag, list);
	}
	return jsxByTag;
}

function functionParents(program: Node): Map<Node, Node | null> {
	const fnParent = new Map<Node, Node | null>();
	for (const { node, ancestors } of walk(program)) {
		if (FUNCTION_TYPES.has(node.type)) {
			fnParent.set(node, ancestors.at(-1) ?? null);
		}
	}
	return fnParent;
}

/**
 * If a PascalCase helper must be async, every same-file function that renders
 * `<Helper />` must be async too — then those callers, until every injected
 * `await Helper(...)` sits in an async context.
 */
function propagateHelperParents(
	program: Node,
	needsAsync: Set<Node>,
	fileId: string,
	code: string,
): void {
	const fnParent = functionParents(program);
	const jsxByTag = jsxUsagesByTag(program);
	const exported = defaultExportNames(program);
	let grew = true;
	while (grew) {
		grew = false;
		for (const fn of needsAsync) {
			const name = functionName(fn, fnParent.get(fn) ?? null);
			if (!name || !/^[A-Z]/.test(name) || exported.has(name)) continue;
			for (const usage of jsxByTag.get(name) ?? []) {
				const enclosing = innermostFunction(usage.ancestors);
				if (!enclosing || needsAsync.has(enclosing.fn)) continue;
				if (isMethodParent(enclosing.parent)) {
					throwUnrewritable("method", fileId, code, enclosing.fn.start);
				}
				needsAsync.add(enclosing.fn);
				grew = true;
			}
		}
	}
}

function jsxTagName(element: Node): string | null {
	if (!isNode(element.openingElement)) return null;
	const name = element.openingElement.name;
	return isNode(name) && name.type === "JSXIdentifier" && typeof name.name === "string"
		? name.name
		: null;
}

function asyncInserts(needsAsync: Set<Node>): Edit[] {
	const edits: Edit[] = [];
	for (const fn of needsAsync) {
		if (fn.async === true) continue;
		edits.push({ start: fn.start, end: fn.start, text: "async " });
	}
	return edits;
}

function calleeMember(call: Node): Node | null {
	if (!isNode(call.callee)) return null;
	const callee = unwrap(call.callee);
	const member =
		callee.type === "ChainExpression" && isNode(callee.expression) ? callee.expression : callee;
	if (member.type !== "MemberExpression") return null;
	return member;
}

function calleePropertyName(call: Node): string | null {
	const member = calleeMember(call);
	if (!member || member.computed === true || !isNode(member.property)) return null;
	return identName(member.property);
}

function isPromiseAllCall(node: Node): boolean {
	if (node.type !== "CallExpression") return false;
	const callee = unwrap(isNode(node.callee) ? node.callee : node);
	if (callee.type !== "MemberExpression" || callee.computed === true) return false;
	return identName(callee.object) === "Promise" && identName(callee.property) === "all";
}

/** `obj?.map()`, `obj.map?.()`, or a ChainExpression callee — the call may be `undefined`. */
function isOptionalCall(node: Node): boolean {
	if (node.optional === true) return true;
	if (!isNode(node.callee)) return false;
	const callee = unwrap(node.callee);
	if (callee.type === "ChainExpression") return true;
	return callee.type === "MemberExpression" && callee.optional === true;
}

function firstArg(call: Node): Node | null {
	const args = Array.isArray(call.arguments) ? call.arguments : [];
	return args[0] && isNode(args[0]) ? unwrap(args[0]) : null;
}

function callbackNeedsAwait(
	callback: Node | null,
	needsAsync: Set<Node>,
	helpers: Set<string>,
): boolean {
	if (!callback) return false;
	if (needsAsync.has(callback)) return true;
	const name = identName(callback);
	return Boolean(name && helpers.has(name));
}

const LIST_METHODS = new Set(["map", "flatMap"]);
const UNREWRITABLE_LIST_METHODS = new Set([
	"forEach",
	"filter",
	"reduce",
	"reduceRight",
	"some",
	"every",
	"find",
	"findIndex",
	"findLast",
	"findLastIndex",
]);

function assertRewritableListCallbacks(
	program: Node,
	needsAsync: Set<Node>,
	helpers: Set<string>,
	fileId: string,
	code: string,
): void {
	for (const { node } of walk(program)) {
		if (node.type !== "CallExpression") continue;
		const method = calleePropertyName(node);
		if (!method || !UNREWRITABLE_LIST_METHODS.has(method)) continue;
		if (!callbackNeedsAwait(firstArg(node), needsAsync, helpers)) continue;
		throwUnrewritable(`${method}() callback`, fileId, code, node.start);
	}
}

/**
 * Wrapping `inner.map` in `await Promise.all` puts a new `await` in the parent
 * function (often an outer `.map` callback). That parent must become async too,
 * or oxc will reject the rewritten module.
 */
function propagateListParents(
	program: Node,
	needsAsync: Set<Node>,
	helpers: Set<string>,
	fileId: string,
	code: string,
): void {
	let grew = true;
	while (grew) {
		grew = false;
		for (const { node, ancestors } of walk(program)) {
			if (node.type !== "CallExpression") continue;
			const method = calleePropertyName(node);
			if (!method || !LIST_METHODS.has(method)) continue;
			if (!callbackNeedsAwait(firstArg(node), needsAsync, helpers)) continue;
			const parent = ancestors.at(-1) ?? null;
			if (parent && isPromiseAllCall(parent)) continue;

			const enclosing = innermostFunction(ancestors);
			if (!enclosing) continue;
			if (isMethodParent(enclosing.parent)) {
				throwUnrewritable("method", fileId, code, node.start);
			}
			if (enclosing.fn.generator === true) {
				throwUnrewritable("generator", fileId, code, node.start);
			}
			if (needsAsync.has(enclosing.fn)) continue;
			needsAsync.add(enclosing.fn);
			grew = true;
		}
	}
}

function mapWraps(program: Node, needsAsync: Set<Node>): Edit[] {
	const helpers = localHelperNames(needsAsync, program);
	const edits: Edit[] = [];
	for (const { node, ancestors } of walk(program)) {
		if (node.type !== "CallExpression") continue;
		const method = calleePropertyName(node);
		if (!method || !LIST_METHODS.has(method)) continue;
		if (!callbackNeedsAwait(firstArg(node), needsAsync, helpers)) continue;

		const parent = ancestors.at(-1) ?? null;
		if (parent && isPromiseAllCall(parent)) continue;

		const optional = isOptionalCall(node);
		if (method === "flatMap") {
			const member = calleeMember(node);
			const prop = member && isNode(member.property) ? member.property : null;
			edits.push({ start: node.start, end: node.start, text: "(await Promise.all(" });
			if (prop) edits.push({ start: prop.start, end: prop.end, text: "map" });
			edits.push({
				start: node.end,
				end: node.end,
				text: optional ? " ?? [])).flat()" : ")).flat()",
			});
			continue;
		}

		edits.push({ start: node.start, end: node.start, text: "await Promise.all(" });
		edits.push({
			start: node.end,
			end: node.end,
			text: optional ? " ?? [])" : ")",
		});
	}
	return edits;
}

function localHelperNames(needsAsync: Set<Node>, program: Node): Set<string> {
	const exported = defaultExportNames(program);
	const names = new Set<string>();
	for (const { node, ancestors } of walk(program)) {
		if (!needsAsync.has(node)) continue;
		const name = functionName(node, ancestors.at(-1) ?? null);
		if (name && /^[A-Z]/.test(name) && !exported.has(name)) names.add(name);
	}
	return names;
}

function jsxAttributeToProp(attr: Node, code: string): string | null {
	if (attr.type === "JSXSpreadAttribute" && isNode(attr.argument)) {
		return `...${code.slice(attr.argument.start, attr.argument.end)}`;
	}
	if (attr.type !== "JSXAttribute" || !isNode(attr.name)) return null;
	const name = typeof attr.name.name === "string" ? attr.name.name : null;
	if (!name || name === "key") return null;
	if (!isNode(attr.value)) return `${name}: true`;
	if (attr.value.type === "JSXExpressionContainer" && isNode(attr.value.expression)) {
		const expr = attr.value.expression;
		return `${name}: ${code.slice(expr.start, expr.end)}`;
	}
	return `${name}: ${code.slice(attr.value.start, attr.value.end)}`;
}

function jsxKeyExpression(attr: Node, code: string): string | null {
	if (attr.type !== "JSXAttribute" || !isNode(attr.name)) return null;
	const name = typeof attr.name.name === "string" ? attr.name.name : null;
	if (name !== "key" || !isNode(attr.value)) return null;
	if (attr.value.type === "JSXExpressionContainer" && isNode(attr.value.expression)) {
		const expr = attr.value.expression;
		return code.slice(expr.start, expr.end);
	}
	return code.slice(attr.value.start, attr.value.end);
}

function jsxOpeningProps(
	opening: Node | null,
	code: string,
): { props: string[]; keyExpr: string | null } {
	const props: string[] = [];
	let keyExpr: string | null = null;
	const attributes = opening && Array.isArray(opening.attributes) ? opening.attributes : [];
	for (const attr of attributes) {
		if (!isNode(attr)) continue;
		const key = jsxKeyExpression(attr, code);
		if (key != null) {
			keyExpr = key;
			continue;
		}
		const prop = jsxAttributeToProp(attr, code);
		if (prop) props.push(prop);
	}
	return { props, keyExpr };
}

function jsxElementToAwaitCall(element: Node, tag: string, code: string): string {
	const opening = isNode(element.openingElement) ? element.openingElement : null;
	const { props, keyExpr } = jsxOpeningProps(opening, code);

	if (opening?.selfClosing !== true && isNode(element.closingElement)) {
		const inner = code.slice(opening ? opening.end : element.start, element.closingElement.start);
		if (inner.trim()) props.push(`children: (${inner})`);
	}

	const obj = props.length > 0 ? `{ ${props.join(", ")} }` : "{}";
	const call = `await ${tag}(${obj})`;
	return keyExpr == null ? call : `__pageKeyed(${keyExpr}, ${call})`;
}

function jsxRewrites(program: Node, needsAsync: Set<Node>, code: string): Edit[] {
	const helpers = localHelperNames(needsAsync, program);
	if (helpers.size === 0) return [];

	const edits: Edit[] = [];
	for (const { node, ancestors } of walk(program)) {
		if (node.type !== "JSXElement") continue;
		const tag = jsxTagName(node);
		if (!tag || !helpers.has(tag)) continue;

		const parent = ancestors.at(-1);
		const asChild = parent?.type === "JSXElement" || parent?.type === "JSXFragment";
		const call = jsxElementToAwaitCall(node, tag, code);
		edits.push({
			start: node.start,
			end: node.end,
			text: asChild ? `{${call}}` : call,
		});
	}
	return edits;
}

function applyEdits(code: string, edits: Edit[]): string {
	const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
	let result = code;
	for (const edit of ordered) {
		result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
	}
	return result;
}

/**
 * Rewrites a page/layout module so every `await` sits in an async function
 * and list islands resolve through `await Promise.all`.
 */
export function ensureAwaitContextsAsync(code: string, fileId: string): string {
	const program = parseTsx(code, fileId);
	const needsAsync = collectFunctionsNeedingAsync(program, fileId, code);
	let helpers = localHelperNames(needsAsync, program);
	let previous = 0;
	while (needsAsync.size !== previous) {
		previous = needsAsync.size;
		helpers = localHelperNames(needsAsync, program);
		propagateListParents(program, needsAsync, helpers, fileId, code);
		propagateHelperParents(program, needsAsync, fileId, code);
	}
	assertRewritableListCallbacks(program, needsAsync, helpers, fileId, code);
	return applyEdits(code, [
		...asyncInserts(needsAsync),
		...mapWraps(program, needsAsync),
		...jsxRewrites(program, needsAsync, code),
	]);
}
