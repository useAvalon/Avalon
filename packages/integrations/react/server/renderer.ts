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
  
  const logPrefix = `🔄 [React:${src}]`;
  const renderStart = performance.now();

  console.log(`${logPrefix} Starting React SSR rendering...`, {
    ssrOnly,
    propsKeys: Object.keys(props),
    isDev: Deno.env.get("DENO_ENV") !== "production",
  });
  
  try {
    const moduleStart = performance.now();
    
    // Load the component if not provided
    const Component = component || await loadComponent(src);
    
    const moduleLoadTime = performance.now() - moduleStart;
    console.log(
      `${logPrefix} ✅ Module loaded in ${moduleLoadTime.toFixed(2)}ms`,
      {
        componentType: typeof Component,
        isFunction: typeof Component === "function",
      },
    );
    
    if (!Component || typeof Component !== "function") {
      throw new Error(
        `Invalid React component in ${src}: expected function, got ${typeof Component}`,
      );
    }
    
    // Analyze component to determine if it's a Server Component or Client Component
    const metadata = analyzeComponent(src);
    const hasUseClient = hasUseClientDirective(src);
    
    // Determine if this is a Server Component:
    // - Has "use server" directive, OR
    // - Does NOT have "use client" directive (default to Server Component)
    // - Unless explicitly marked as isServerComponent in params
    const isServerComponent = params.isServerComponent ?? 
      (metadata.isServerComponent || !hasUseClient);
    
    console.log(`${logPrefix} Component classification:`, {
      isServerComponent,
      hasUseClient,
      hasUseServer: metadata.isServerComponent,
      hasAsyncRender: metadata.hasAsyncRender,
    });
    
    // Normalize and serialize props
    const normalizedProps = serializeProps(props);
    
    let html: string;
    let element: ReactElement | undefined;
    
    // Render based on component type
    const renderStringStart = performance.now();
    
    if (isServerComponent) {
      html = await renderServerComponent(
        Component as ComponentType<Record<string, unknown>>,
        normalizedProps
      );
    } else {
      element = createElement(Component as ComponentType<Record<string, unknown>>, normalizedProps);
      html = renderToString(element);
    }
    
    const renderStringTime = performance.now() - renderStringStart;
    
    console.log(
      `${logPrefix} ✅ React renderToString completed in ${renderStringTime.toFixed(2)}ms`,
      {
        htmlLength: html.length,
        htmlPreview: html.substring(0, 100) + (html.length > 100 ? "..." : ""),
      },
    );
    
    // For Server Components, don't generate hydration data
    // For Client Components, generate hydration data unless ssrOnly
    const shouldHydrate = !isServerComponent && !ssrOnly;
    
    const hydrationData = shouldHydrate ? {
      src,
      props,
      framework: "react" as const,
      condition,
      metadata: {
        isServerComponent: false,
      },
    } : undefined;
    
    const result: ReactRenderResult = {
      html,
      element,
      isServerComponent,
      hydrationData,
    };
    
    const totalTime = performance.now() - renderStart;
    console.log(
      `${logPrefix} ✅ React SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
    );
    
    return result;
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ React SSR failed after ${failTime.toFixed(2)}ms:`,
      error,
    );
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to render React component from ${src}: ${errorMessage}`,
      { cause: error }
    );
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
 * Provides graceful fallback if rendering fails
 * 
 * @param params - Render parameters
 * @param fallback - Fallback React element or HTML string on error
 * @returns Render result with HTML and hydration data
 */
export async function renderWithErrorBoundary(
  params: ReactRenderParams,
  fallback?: ReactElement | string
): Promise<ReactRenderResult> {
  const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params;
  
  const logPrefix = `🔄 [React:${src}:ErrorBoundary]`;
  console.log(`${logPrefix} Rendering with error boundary...`);
  
  try {
    // Load the component if not provided
    const Component = component || await loadComponent(src);
    
    if (!Component || typeof Component !== "function") {
      throw new Error(
        `Invalid React component in ${src}: expected function, got ${typeof Component}`,
      );
    }
    
    // Analyze component to determine if it's a Server Component or Client Component
    const metadata = analyzeComponent(src);
    const hasUseClient = hasUseClientDirective(src);
    const isServerComponent = params.isServerComponent ?? 
      (metadata.isServerComponent || !hasUseClient);
    
    // Normalize and serialize props
    const normalizedProps = serializeProps(props);
    
    // Determine fallback element
    let fallbackElement: ReactElement | undefined;
    if (typeof fallback === "string") {
      // Convert string to React element
      fallbackElement = createElement("div", { 
        dangerouslySetInnerHTML: { __html: fallback } 
      });
    } else {
      fallbackElement = fallback;
    }
    
    let html: string;
    let element: ReactElement;
    
    // Wrap component in Error Boundary
    if (isServerComponent) {
      // For Server Components, we can't use Error Boundary wrapper
      // Fall back to try-catch approach
      try {
        html = await renderServerComponent(
          Component as ComponentType<Record<string, unknown>>,
          normalizedProps
        );
      } catch (error) {
        console.error(`${logPrefix} Server Component rendering failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (fallbackElement) {
          html = renderToString(fallbackElement);
        } else if (typeof fallback === "string") {
          html = fallback;
        } else {
          html = `<!-- React Server Component SSR failed: ${errorMessage} -->`;
        }
        
        return {
          html,
          isServerComponent: true,
          hydrationData: undefined,
        };
      }
      
      element = createElement("div", { dangerouslySetInnerHTML: { __html: html } });
    } else {
      // For Client Components, wrap in Error Boundary
      element = createErrorBoundaryWrapper(
        Component as ComponentType<Record<string, unknown>>,
        normalizedProps,
        fallbackElement
      );
      html = renderToString(element);
    }
    
    console.log(`${logPrefix} ✅ Rendering with error boundary completed`);
    
    // Generate hydration data
    const shouldHydrate = !isServerComponent && !ssrOnly;
    const hydrationData = shouldHydrate ? {
      src,
      props,
      framework: "react" as const,
      condition,
      metadata: {
        isServerComponent: false,
        hasErrorBoundary: true,
      },
    } : undefined;
    
    return {
      html,
      element,
      isServerComponent,
      hydrationData,
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Error boundary rendering failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Last resort fallback
    let fallbackHtml: string;
    if (typeof fallback === "string") {
      fallbackHtml = fallback;
    } else if (fallback) {
      try {
        fallbackHtml = renderToString(fallback);
      } catch (fallbackError) {
        console.error(`${logPrefix} Failed to render fallback element:`, fallbackError);
        fallbackHtml = `<!-- React SSR failed: ${errorMessage} -->`;
      }
    } else {
      fallbackHtml = `<!-- React SSR failed: ${errorMessage} -->`;
    }
    
    return {
      html: fallbackHtml,
      isServerComponent: false,
      hydrationData: {
        src: params.src,
        props: params.props || {},
        framework: "react",
        metadata: {
          ssrFailed: true,
        },
      },
    };
  }
}
