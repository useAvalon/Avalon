import type { ComponentType } from 'preact';

declare module '*.mdx' {
	const MDXComponent: ComponentType<Record<string, unknown>>;
	export default MDXComponent;
}
