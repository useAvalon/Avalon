// React Server Components renderer

import { type ComponentType, createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";

/**
 * Render a React Server Component
 *
 * Server Components are rendered only on the server and don't include
 * client-side hydration code. They can be async and access server-only resources.
 *
 * @param Component - React component (Server Component)
 * @param props - Component props
 * @returns Rendered HTML string
 */
export async function renderServerComponent(
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
): Promise<string> {
	try {
		// Check if the component is async by checking its constructor name
		// Async functions have constructor name "AsyncFunction"
		const isAsync = Component.constructor.name === "AsyncFunction";

		if (isAsync) {
			// For async Server Components, we need to await the result
			// The component function returns a Promise<ReactElement>
			console.log("🔄 [RSC] Rendering async Server Component...");
			const result = await (
				Component as unknown as (props: Record<string, unknown>) => Promise<ReactElement>
			)(props);

			// Render the awaited result to string
			const html = renderToString(result);
			console.log("✅ [RSC] Async Server Component rendered successfully");
			return html;
		}

		// For sync Server Components, render normally
		console.log("🔄 [RSC] Rendering sync Server Component...");
		const element = createElement(Component, props);
		const html = renderToString(element);
		console.log("✅ [RSC] Sync Server Component rendered successfully");
		return html;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ [RSC] Failed to render Server Component:", error);
		throw new Error(`Failed to render React Server Component: ${errorMessage}`, { cause: error });
	}
}
