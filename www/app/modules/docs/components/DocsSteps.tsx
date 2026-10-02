import { type ComponentChildren, Fragment, isValidElement, type VNode } from "preact";
import styles from "./DocsSteps.module.css";

interface DocsStepsProps {
	children: ComponentChildren;
}

function flatten(children: ComponentChildren): unknown[] {
	if (children == null || typeof children === "boolean") return [];
	if (Array.isArray(children)) return children.flatMap(flatten);
	if (isValidElement(children) && children.type === Fragment) {
		return flatten(children.props.children);
	}
	return [children];
}

function isHeading(node: unknown): node is VNode {
	if (!isValidElement(node)) return false;
	return node.type === "h2" || node.type === "h3";
}

function isIgnorable(node: unknown): boolean {
	return typeof node === "string" && node.trim() === "";
}

/** Group MDX children into one step per h2/h3. Unwraps a single wrapper if needed. */
export function groupDocsSteps(children: ComponentChildren): unknown[][] {
	let nodes = flatten(children);
	const hasHeading = nodes.some(isHeading);
	if (
		!hasHeading &&
		nodes.length === 1 &&
		isValidElement(nodes[0]) &&
		nodes[0].props &&
		typeof nodes[0].props === "object" &&
		"children" in nodes[0].props
	) {
		nodes = flatten((nodes[0].props as { children: ComponentChildren }).children);
	}

	const groups: unknown[][] = [];
	let current: unknown[] | null = null;

	for (const node of nodes) {
		if (isIgnorable(node)) continue;
		if (isHeading(node)) {
			current = [node];
			groups.push(current);
			continue;
		}
		if (!current) {
			current = [];
			groups.push(current);
		}
		current.push(node);
	}

	return groups;
}

function stepKey(group: unknown[], index: number): string {
	const heading = group.find(isHeading);
	if (isValidElement(heading)) {
		const text = heading.props.children;
		if (typeof text === "string" && text.length > 0) return text;
	}
	return `step-${index + 1}`;
}

export default function DocsSteps({ children }: Readonly<DocsStepsProps>) {
	const groups = groupDocsSteps(children);

	return (
		<div class={`docs-steps ${styles.steps}`}>
			{groups.map((group, index) => (
				<div class={`docs-step ${styles.step}`} key={stepKey(group, index)}>
					<span class={`docs-step-num ${styles.num}`} aria-hidden="true">
						{index + 1}
					</span>
					<div class={`docs-step-body ${styles.body}`}>{group as ComponentChildren}</div>
				</div>
			))}
		</div>
	);
}
