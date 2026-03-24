// Server-side rendering logic for React components

import { Component, type ComponentType, createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import type { ReactRenderParams, ReactRenderResult } from "../types.ts";
import { renderServerComponent } from "./rsc-renderer.ts";
import { analyzeComponent, hasUseClientDirective, loadComponent, serializeProps } from "./utils.ts";

/**
 * Props for Error Boundary component
 */
interface ErrorBoundaryProps {
	children?: ReactElement;
	fallback?: ReactElement;
}

/**
 * State for Error Boundary component
 */
interface ErrorBoundaryState {
	hasError: boolean;
	error?: Error;
}

/**
 * React Error Boundary component for SSR
 * Catches errors during rendering and displays fallback UI
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	declare props: ErrorBoundaryProps;
	state: ErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: unknown): void {
		console.error("React Error Boundary caught error:", error, errorInfo);
	}

	render(): ReactElement {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}
			return createElement(
				"div",
				{ style: { padding: "20px", border: "1px solid #f00", color: "#f00" } },
				createElement("h3", null, "Something went wrong"),
				createElement("p", null, this.state.error?.message || "Unknown error"),
			);
		}

		return this.props.children ?? createElement("div", null);
	}
}

/**
 * Render a React component on the server
 *
 * @param params - Render parameters
 * @returns Render result with HTML and hydration data
 */
export async function render(params: ReactRenderParams): Promise<ReactRenderResult> {
	const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params;

	try {
		const Component = component || (await loadComponent(src));

		if (!Component || typeof Component !== "function") {
			throw new Error(
				`Invalid React component in ${src}: expected function, got ${typeof Component}`,
			);
		}

		// When a pre-loaded component reference is provided (bundled SSR),
		// skip file-based analysis since source files aren't on disk.
		// The island transform only passes component refs for client
		// components, so default to client-component rendering.
		let isServerComponent: boolean;
		if (params.isServerComponent != null) {
			isServerComponent = params.isServerComponent;
		} else if (component) {
			isServerComponent = false;
		} else {
			const metadata = await analyzeComponent(src);
			const hasUseClient = await hasUseClientDirective(src);
			isServerComponent = metadata.isServerComponent || (!hasUseClient && !metadata.hasHooks);
		}

		const normalizedProps = serializeProps(props);

		let html: string;
		let element: ReactElement | undefined;

		if (isServerComponent) {
			html = await renderServerComponent(Component, normalizedProps);
		} else {
			element = createElement(Component, normalizedProps);
			html = renderToString(element);
		}

		const shouldHydrate = !isServerComponent && !ssrOnly;

		return {
			html,
			element,
			isServerComponent,
			hydrationData: shouldHydrate
				? {
						src,
						props,
						framework: "react" as const,
						condition,
						metadata: { isServerComponent: false },
					}
				: undefined,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[react-ssr] Failed to render ${src}:`, error);
		throw new Error(`Failed to render React component from ${src}: ${errorMessage}`, {
			cause: error,
		});
	}
}

/**
 * Create an Error Boundary wrapper for a component
 *
 * @param Component - The component to wrap
 * @param props - Component props
 * @param fallback - Fallback element to show on error
 * @returns Wrapped component element
 */
function createErrorBoundaryWrapper(
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
	fallback?: ReactElement,
): ReactElement {
	const componentElement = createElement(Component, props);
	return createElement(ErrorBoundary, { fallback }, componentElement);
}

/**
 * Resolves fallback to a ReactElement if it's a string
 */
function resolveFallbackElement(fallback?: ReactElement | string): ReactElement | undefined {
	if (typeof fallback === "string") {
		return createElement("div", { dangerouslySetInnerHTML: { __html: fallback } });
	}
	return fallback;
}

/**
 * Renders a server component with fallback on failure
 */
async function renderServerComponentWithFallback(
	Component: ComponentType<Record<string, unknown>>,
	normalizedProps: Record<string, unknown>,
	fallbackElement: ReactElement | undefined,
	fallback: ReactElement | string | undefined,
): Promise<{ html: string; element: ReactElement; failed: boolean }> {
	try {
		const html = await renderServerComponent(Component, normalizedProps);
		const element = createElement("div", { dangerouslySetInnerHTML: { __html: html } });
		return { html, element, failed: false };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		let html: string;
		if (fallbackElement) {
			html = renderToString(fallbackElement);
		} else if (typeof fallback === "string") {
			html = fallback;
		} else {
			html = `<!-- React Server Component SSR failed: ${errorMessage.replaceAll("-->", "--&gt;")} -->`;
		}
		const element = createElement("div", { dangerouslySetInnerHTML: { __html: html } });
		return { html, element, failed: true };
	}
}

/**
 * Builds a fallback HTML string from various fallback types
 */
function buildFallbackHtml(errorMessage: string, fallback?: ReactElement | string): string {
	if (typeof fallback === "string") {
		return fallback;
	}
	if (fallback) {
		try {
			return renderToString(fallback);
		} catch {
			// fall through to default
		}
	}
	return `<!-- React SSR failed: ${errorMessage.replaceAll("-->", "--&gt;")} -->`;
}

/**
 * Render a React component with error boundary
 */
export async function renderWithErrorBoundary(
	params: ReactRenderParams,
	fallback?: ReactElement | string,
): Promise<ReactRenderResult> {
	const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params;

	try {
		const Component = component || (await loadComponent(src));

		if (!Component || typeof Component !== "function") {
			throw new Error(
				`Invalid React component in ${src}: expected function, got ${typeof Component}`,
			);
		}

		let isServerComponent: boolean;
		if (params.isServerComponent != null) {
			isServerComponent = params.isServerComponent;
		} else if (component) {
			isServerComponent = false;
		} else {
			const metadata = await analyzeComponent(src);
			const hasUseClient = await hasUseClientDirective(src);
			isServerComponent = metadata.isServerComponent || (!hasUseClient && !metadata.hasHooks);
		}

		const normalizedProps = serializeProps(props);
		const fallbackElement = resolveFallbackElement(fallback);

		let html: string;
		let element: ReactElement;

		if (isServerComponent) {
			const result = await renderServerComponentWithFallback(
				Component,
				normalizedProps,
				fallbackElement,
				fallback,
			);
			if (result.failed) {
				return { html: result.html, isServerComponent: true, hydrationData: undefined };
			}
			html = result.html;
			element = result.element;
		} else {
			element = createErrorBoundaryWrapper(Component, normalizedProps, fallbackElement);
			html = renderToString(element);
		}

		const shouldHydrate = !isServerComponent && !ssrOnly;

		return {
			html,
			element,
			isServerComponent,
			hydrationData: shouldHydrate
				? {
						src,
						props,
						framework: "react" as const,
						condition,
						metadata: { isServerComponent: false, hasErrorBoundary: true },
					}
				: undefined,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			html: buildFallbackHtml(errorMessage, fallback),
			isServerComponent: false,
			hydrationData: {
				src: params.src,
				props: params.props || {},
				framework: "react",
				metadata: { ssrFailed: true },
			},
		};
	}
}
