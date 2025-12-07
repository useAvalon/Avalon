/**
 * Abstract base class for framework integrations.
 * Provides common functionality and enforces the Integration interface.
 */

import type {
  Integration,
  IntegrationConfig,
  RenderParams,
  RenderResult,
} from "./types.ts";

/**
 * Abstract base class that integrations can extend to inherit common functionality
 */
export abstract class BaseIntegration implements Integration {
  abstract name: string;
  abstract version: string;

  /**
   * Render a component to HTML (must be implemented by subclass)
   */
  abstract render(params: RenderParams): Promise<RenderResult>;

  /**
   * Get hydration script (must be implemented by subclass)
   */
  abstract getHydrationScript(): string;

  /**
   * Get integration configuration (must be implemented by subclass)
   */
  abstract config(): IntegrationConfig;

  /**
   * Optional Vite plugin configuration
   * Subclasses can override this to provide build-time processing
   */
  vitePlugin?(): any | any[] {
    return undefined;
  }

  /**
   * Validate render parameters
   * @param params - Parameters to validate
   * @throws Error if parameters are invalid
   */
  protected validateRenderParams(params: RenderParams): void {
    if (!params.src) {
      throw new Error(
        `[${this.name}] Missing required parameter: src`,
      );
    }

    if (typeof params.props !== "object" || params.props === null) {
      throw new Error(
        `[${this.name}] Invalid props: must be an object`,
      );
    }
  }

  /**
   * Create a render error with integration context
   * @param message - Error message
   * @param cause - Original error
   * @returns Error with context
   */
  protected createRenderError(message: string, cause?: unknown): Error {
    const error = new Error(
      `[${this.name}] ${message}`,
      cause ? { cause } : undefined,
    );
    return error;
  }

  /**
   * Log a warning message with integration context
   * @param message - Warning message
   */
  protected warn(message: string): void {
    console.warn(`[${this.name}] ${message}`);
  }

  /**
   * Log an error message with integration context
   * @param message - Error message
   * @param error - Optional error object
   */
  protected error(message: string, error?: unknown): void {
    console.error(`[${this.name}] ${message}`, error || "");
  }

  /**
   * Check if running in development mode
   * @param params - Render parameters
   * @returns True if in development mode
   */
  protected isDevelopment(params: RenderParams): boolean {
    return params.isDev ?? Deno.env.get("DENO_ENV") !== "production";
  }

  /**
   * Get the Vite dev server if available
   * @param params - Render parameters
   * @returns Vite dev server or undefined
   */
  protected getViteServer(params: RenderParams): any {
    return params.viteServer ?? (globalThis as any).__viteDevServer;
  }
}
