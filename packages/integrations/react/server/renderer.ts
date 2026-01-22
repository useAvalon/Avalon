// Server-side rendering logic for React components

import { createElement, Component, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import type { ReactRenderParams, ReactRenderResult } from "../types.ts";
import { loadComponent, serializeProps, hasUseClientDirective, analyzeComponent } from "./utils.ts";
import { renderServerComponent } from "./rsc-renderer.ts";

/**
 * Props for Error Boundary component
 */
interface ErrorBoundaryProps {
  children: ReactElement;
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

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

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
        createElement("p", null, this.state.error?.message || "Unknown error")
      );
    }

    return this.props.children;
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
    const Component = component || await loadComponent(src);
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid React component in ${src}: expected function, got ${typeof Component}`);
    }
    
    const metadata = analyzeComponent(src);
    const hasUseClient = hasUseClientDirective(src);
    const isServerComponent = params.isServerComponent ?? (metadata.isServerComponent || !hasUseClient);
    const normalizedProps = serializeProps(props);
    
    let html: string;
    let element: ReactElement | undefined;
    
    if (isServerComponent) {
      html = await renderServerComponent(Component as ComponentType<Record<string, unknown>>, normalizedProps);
    } else {
      element = createElement(Component as ComponentType<Record<string, unknown>>, normalizedProps);
      html = renderToString(element);
    }
    
    const shouldHydrate = !isServerComponent && !ssrOnly;
    
    return {
      html,
      element,
      isServerComponent,
      hydrationData: shouldHydrate ? {
        src,
        props,
        framework: "react" as const,
        condition,
        metadata: { isServerComponent: false },
      } : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render React component from ${src}: ${errorMessage}`, { cause: error });
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
  fallback?: ReactElement
): ReactElement {
  const componentElement = createElement(Component, props);
  return createElement(
    ErrorBoundary,
    { fallback },
    componentElement
  );
}

/**
 * Render a React component with error boundary
 */
export async function renderWithErrorBoundary(
  params: ReactRenderParams,
  fallback?: ReactElement | string
): Promise<ReactRenderResult> {
  const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params;
  
  try {
    const Component = component || await loadComponent(src);
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid React component in ${src}: expected function, got ${typeof Component}`);
    }
    
    const metadata = analyzeComponent(src);
    const hasUseClient = hasUseClientDirective(src);
    const isServerComponent = params.isServerComponent ?? (metadata.isServerComponent || !hasUseClient);
    const normalizedProps = serializeProps(props);
    
    let fallbackElement: ReactElement | undefined;
    if (typeof fallback === "string") {
      fallbackElement = createElement("div", { dangerouslySetInnerHTML: { __html: fallback } });
    } else {
      fallbackElement = fallback;
    }
    
    let html: string;
    let element: ReactElement;
    
    if (isServerComponent) {
      try {
        html = await renderServerComponent(Component as ComponentType<Record<string, unknown>>, normalizedProps);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (fallbackElement) {
          html = renderToString(fallbackElement);
        } else if (typeof fallback === "string") {
          html = fallback;
        } else {
          html = `<!-- React Server Component SSR failed: ${errorMessage} -->`;
        }
        return { html, isServerComponent: true, hydrationData: undefined };
      }
      element = createElement("div", { dangerouslySetInnerHTML: { __html: html } });
    } else {
      element = createErrorBoundaryWrapper(Component as ComponentType<Record<string, unknown>>, normalizedProps, fallbackElement);
      html = renderToString(element);
    }
    
    const shouldHydrate = !isServerComponent && !ssrOnly;
    
    return {
      html,
      element,
      isServerComponent,
      hydrationData: shouldHydrate ? {
        src,
        props,
        framework: "react" as const,
        condition,
        metadata: { isServerComponent: false, hasErrorBoundary: true },
      } : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let fallbackHtml: string;
    
    if (typeof fallback === "string") {
      fallbackHtml = fallback;
    } else if (fallback) {
      try {
        fallbackHtml = renderToString(fallback);
      } catch {
        fallbackHtml = `<!-- React SSR failed: ${errorMessage} -->`;
      }
    } else {
      fallbackHtml = `<!-- React SSR failed: ${errorMessage} -->`;
    }
    
    return {
      html: fallbackHtml,
      isServerComponent: false,
      hydrationData: { src: params.src, props: params.props || {}, framework: "react", metadata: { ssrFailed: true } },
    };
  }
}
