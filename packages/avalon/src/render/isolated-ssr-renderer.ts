/**
 * Isolated SSR Renderer
 *
 * This module provides framework-specific SSR contexts to prevent cross-contamination
 * between different frameworks during server-side rendering. Each framework gets its
 * own isolated import context and rendering pipeline.
 */

import { readFile } from "node:fs/promises";
import type { JSX } from "preact";
import { render as preactRenderToString } from "preact-render-to-string";
import { EnhancedFrameworkDetector } from "../core/components/enhanced-framework-detector.ts";
import { toImportSpecifier } from "../middleware/executor.ts";

export interface FrameworkSSRContext {
	framework: string;
	imports: Map<string, unknown>;
	renderFunction: (component: unknown, props: unknown) => Promise<string>;
	cleanup: () => void;
	isActive: boolean;
}

export interface SSRIsolationConfig {
	enableStrictIsolation: boolean;
	allowedCrossFrameworkImports: string[];
	errorHandling: "strict" | "fallback" | "ignore";
	debugLogging: boolean;
}

export interface IsolatedRenderRequest {
	componentPath: string;
	component: () => JSX.Element | Promise<JSX.Element>;
	framework?: string;
	props?: Record<string, unknown>;
}

export interface IsolatedRenderResult {
	html: string;
	framework: string;
	success: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Isolated SSR Renderer with framework-specific contexts
 */
export class IsolatedSSRRenderer {
	private readonly contexts: Map<string, FrameworkSSRContext>;
	private readonly detector: EnhancedFrameworkDetector;
	private config: SSRIsolationConfig;
	private activeContext: string | null = null;

	constructor(config: Partial<SSRIsolationConfig> = {}) {
		this.contexts = new Map();
		this.detector = new EnhancedFrameworkDetector();
		this.config = {
			enableStrictIsolation: true,
			allowedCrossFrameworkImports: ["preact", "preact-render-to-string"],
			errorHandling: "fallback",
			debugLogging: false,
			...config,
		};

		this.initializeFrameworkContexts();
	}

	/**
	 * Renders a component with framework isolation
	 */
	async renderWithIsolation(request: IsolatedRenderRequest): Promise<IsolatedRenderResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			const framework = await this.resolveFramework(request, warnings);
			return await this.renderInContext(request, framework, errors, warnings);
		} catch (error) {
			errors.push(
				`SSR rendering failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			return await this.tryFallbackRender(request, errors, warnings);
		}
	}

	private async resolveFramework(
		request: IsolatedRenderRequest,
		warnings: string[],
	): Promise<string> {
		if (request.framework) return request.framework;

		try {
			const content = await this.getComponentContent(request.componentPath);
			const detection = this.detector.detectFramework(request.componentPath, content);

			if (detection.confidence === "low") {
				warnings.push(
					`Low confidence framework detection for ${request.componentPath}: ${detection.framework}`,
				);
			}
			if (this.config.debugLogging) {
				console.log(
					`[SSR Isolation] Detected framework: ${detection.framework} for ${request.componentPath}`,
				);
				console.log(`[SSR Isolation] Evidence: ${detection.evidence.join(", ")}`);
			}
			return detection.framework;
		} catch {
			// Component path is a virtual/route path — can't read file, default to preact
			warnings.push(
				`Could not read component file for framework detection: ${request.componentPath}, defaulting to preact`,
			);
			return "preact";
		}
	}

	private async renderInContext(
		request: IsolatedRenderRequest,
		framework: string,
		errors: string[],
		warnings: string[],
	): Promise<IsolatedRenderResult> {
		const context = this.getFrameworkContext(framework);
		if (!context) throw new Error(`No SSR context available for framework: ${framework}`);

		await this.switchToContext(framework);
		try {
			const componentResult = request.component();
			const resolvedComponent =
				componentResult instanceof Promise ? await componentResult : componentResult;
			const html = await context.renderFunction(resolvedComponent, request.props || {});
			return { html, framework, success: true, errors, warnings };
		} finally {
			this.cleanupContext(framework);
		}
	}

	private async tryFallbackRender(
		request: IsolatedRenderRequest,
		errors: string[],
		warnings: string[],
	): Promise<IsolatedRenderResult> {
		if (this.config.errorHandling !== "fallback") {
			return {
				html: "",
				framework: request.framework || "unknown",
				success: false,
				errors,
				warnings,
			};
		}
		try {
			const resolvedComponent = await request.component();
			const html = preactRenderToString(resolvedComponent);
			warnings.push("Fell back to Preact rendering due to framework-specific error");
			return { html, framework: "preact", success: true, errors, warnings };
		} catch (fallbackError) {
			errors.push(
				`Fallback rendering also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
			);
			return {
				html: "",
				framework: request.framework || "unknown",
				success: false,
				errors,
				warnings,
			};
		}
	}

	/**
	 * Initializes framework-specific SSR contexts
	 */
	private initializeFrameworkContexts(): void {
		// Preact context
		this.contexts.set("preact", {
			framework: "preact",
			imports: new Map(),
			renderFunction: (component: unknown) => {
				return Promise.resolve(preactRenderToString(component as JSX.Element));
			},
			cleanup: () => {
				this.clearFrameworkGlobals("preact");
			},
			isActive: false,
		});

		this.contexts.set("solid", {
			framework: "solid",
			imports: new Map(),
			renderFunction: async (component: unknown) => {
				try {
					// Import Solid SSR modules in isolation
					const solidWeb = (await this.importFrameworkModule("solid-js/web", "solid")) as Record<
						string,
						unknown
					>;
					if (solidWeb && typeof solidWeb.renderToString === "function") {
						return (solidWeb.renderToString as (fn: () => unknown) => string)(() => component);
					}
					throw new Error("Solid renderToString not available");
				} catch (error) {
					throw new Error(
						`Solid SSR failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			},
			cleanup: () => {
				this.clearFrameworkGlobals("solid");
			},
			isActive: false,
		});

		this.contexts.set("vue", {
			framework: "vue",
			imports: new Map(),
			renderFunction: async (component: unknown) => {
				try {
					// Import Vue SSR modules in isolation
					const vueServerRenderer = (await this.importFrameworkModule(
						"vue/server-renderer",
						"vue",
					)) as Record<string, unknown>;
					if (vueServerRenderer && typeof vueServerRenderer.renderToString === "function") {
						return await (
							vueServerRenderer.renderToString as (component: unknown) => Promise<string>
						)(component);
					}
					throw new Error("Vue renderToString not available");
				} catch (error) {
					throw new Error(
						`Vue SSR failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			},
			cleanup: () => {
				this.clearFrameworkGlobals("vue");
			},
			isActive: false,
		});

		this.contexts.set("svelte", {
			framework: "svelte",
			imports: new Map(),
			renderFunction: (component: unknown) => {
				try {
					// Svelte components have a render method
					if (component && typeof component === "object" && "render" in component) {
						const renderResult = (component as { render: () => { html?: string } }).render();
						return Promise.resolve(renderResult.html || "");
					}
					throw new Error("Svelte component does not have render method");
				} catch (error) {
					throw new Error(
						`Svelte SSR failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			},
			cleanup: () => {
				this.clearFrameworkGlobals("svelte");
			},
			isActive: false,
		});

		this.contexts.set("unknown", {
			framework: "unknown",
			imports: new Map(),
			renderFunction: (component: unknown) => {
				// Fallback to Preact rendering
				return Promise.resolve(preactRenderToString(component as JSX.Element));
			},
			cleanup: () => {
				// No specific cleanup needed
			},
			isActive: false,
		});
	}

	/**
	 * Gets or creates a framework context
	 */
	private getFrameworkContext(framework: string): FrameworkSSRContext | null {
		const context = this.contexts.get(framework);
		if (context) {
			return context;
		}

		// If framework not found, use unknown/fallback context
		return this.contexts.get("unknown") || null;
	}

	/**
	 * Switches to a specific framework context with isolation
	 */
	private async switchToContext(framework: string): Promise<void> {
		// Cleanup previous context if active
		if (this.activeContext && this.activeContext !== framework) {
			this.cleanupContext(this.activeContext);
		}

		const context = this.contexts.get(framework);
		if (!context) {
			throw new Error(`Framework context not found: ${framework}`);
		}

		// Activate the context
		context.isActive = true;
		this.activeContext = framework;

		// Set up framework-specific environment
		await this.setupFrameworkEnvironment(framework);
	}

	/**
	 * Cleans up a framework context
	 */
	private cleanupContext(framework: string): void {
		const context = this.contexts.get(framework);
		if (!context) {
			return;
		}

		// Run framework-specific cleanup
		context.cleanup();
		context.isActive = false;

		// Clear framework-specific imports
		context.imports.clear();

		if (this.activeContext === framework) {
			this.activeContext = null;
		}
	}

	/**
	 * Sets up framework-specific environment
	 */
	private async setupFrameworkEnvironment(framework: string): Promise<void> {
		// Framework-specific setup logic
		switch (framework) {
			case "solid":
				// Ensure Solid-specific globals are available
				await this.ensureSolidEnvironment();
				break;
			case "vue":
				// Ensure Vue-specific globals are available
				await this.ensureVueEnvironment();
				break;
			case "svelte":
				// Ensure Svelte-specific globals are available
				this.ensureSvelteEnvironment();
				break;
			case "preact":
			default:
				// Preact is the default, no special setup needed
				break;
		}
	}

	/**
	 * Imports a framework module with isolation
	 */
	private async importFrameworkModule(modulePath: string, framework: string): Promise<unknown> {
		const context = this.contexts.get(framework);
		if (!context) {
			throw new Error(`No context for framework: ${framework}`);
		}

		// Check if module is already imported in this context
		if (context.imports.has(modulePath)) {
			return context.imports.get(modulePath);
		}

		// Validate import is allowed for this framework
		if (this.config.enableStrictIsolation && !this.isImportAllowed(modulePath, framework)) {
			throw new Error(`Import not allowed in ${framework} context: ${modulePath}`);
		}

		try {
			// Import the module
			const module = await import(/* @vite-ignore */ toImportSpecifier(modulePath));

			// Store in context-specific imports
			context.imports.set(modulePath, module);

			if (this.config.debugLogging) {
				console.log(`[SSR Isolation] Imported ${modulePath} in ${framework} context`);
			}

			return module;
		} catch (error) {
			throw new Error(
				`Failed to import ${modulePath} in ${framework} context: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Checks if an import is allowed for a specific framework
	 */
	private isImportAllowed(modulePath: string, framework: string): boolean {
		// Always allow framework-specific modules
		const frameworkConfig = this.detector.getFrameworkConfigs().get(framework);
		if (frameworkConfig) {
			const allowedModules = [...frameworkConfig.ssrModules, ...frameworkConfig.hydrationModules];
			if (allowedModules.some((allowed) => modulePath.startsWith(allowed))) {
				return true;
			}
		}

		// Check globally allowed cross-framework imports
		return this.config.allowedCrossFrameworkImports.some((allowed) =>
			modulePath.startsWith(allowed),
		);
	}

	/**
	 * Clears framework-specific globals
	 */
	private clearFrameworkGlobals(framework: string): void {
		// Clear framework-specific globals to prevent contamination
		const globals = globalThis as Record<string, unknown>;
		switch (framework) {
			case "solid":
				// Clear Solid-specific globals if they exist
				if (typeof globalThis !== "undefined") {
					delete globals._$HY;
					delete globals.Solid;
				}
				break;
			case "vue":
				// Clear Vue-specific globals if they exist
				if (typeof globalThis !== "undefined") {
					delete globals.__VUE__;
					delete globals.Vue;
				}
				break;
			case "svelte":
				// Clear Svelte-specific globals if they exist
				if (typeof globalThis !== "undefined") {
					delete globals.__SVELTE__;
				}
				break;
		}
	}

	/**
	 * Ensures Solid environment is properly set up
	 */
	private async ensureSolidEnvironment(): Promise<void> {
		try {
			// Import Solid modules needed for SSR
			await this.importFrameworkModule("solid-js/web", "solid");
		} catch (error) {
			if (this.config.debugLogging) {
				console.warn("[SSR Isolation] Failed to set up Solid environment:", error);
			}
		}
	}

	/**
	 * Ensures Vue environment is properly set up
	 */
	private async ensureVueEnvironment(): Promise<void> {
		try {
			// Import Vue modules needed for SSR
			await this.importFrameworkModule("vue/server-renderer", "vue");
		} catch (error) {
			if (this.config.debugLogging) {
				console.warn("[SSR Isolation] Failed to set up Vue environment:", error);
			}
		}
	}

	/**
	 * Ensures Svelte environment is properly set up
	 */
	private ensureSvelteEnvironment(): void {
		try {
			// Svelte components are typically pre-compiled, no special setup needed
			if (this.config.debugLogging) {
				console.log("[SSR Isolation] Svelte environment ready");
			}
		} catch (error) {
			if (this.config.debugLogging) {
				console.warn("[SSR Isolation] Failed to set up Svelte environment:", error);
			}
		}
	}

	/**
	 * Gets component content for framework detection
	 */
	private async getComponentContent(componentPath: string): Promise<string> {
		try {
			// Try to read the component file
			let resolvedPath = componentPath;

			// Handle different path formats
			if (componentPath.startsWith("/")) {
				resolvedPath = componentPath.substring(1);
			}

			// Try multiple path variations
			const pathVariations = [
				resolvedPath,
				`src/islands/${resolvedPath.split("/").pop()}`,
				`islands/${resolvedPath.split("/").pop()}`,
				`examples/${resolvedPath.split("/").pop()}`,
			];

			for (const pathVariation of pathVariations) {
				try {
					return await readFile(pathVariation, "utf-8");
				} catch {}
			}

			throw new Error(`Component file not found: ${componentPath}`);
		} catch (error) {
			throw new Error(
				`Failed to read component content: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Gets current active context
	 */
	getActiveContext(): string | null {
		return this.activeContext;
	}

	/**
	 * Gets all framework contexts
	 */
	getContexts(): Map<string, FrameworkSSRContext> {
		return new Map(this.contexts);
	}

	/**
	 * Updates configuration
	 */
	updateConfig(config: Partial<SSRIsolationConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Resets all contexts
	 */
	resetAllContexts(): void {
		for (const [framework] of this.contexts) {
			this.cleanupContext(framework);
		}
		this.activeContext = null;
	}

	/**
	 * Creates fallback rendering when framework modules are unavailable
	 */
	async renderWithFallback(
		component: () => JSX.Element | Promise<JSX.Element>,
		preferredFramework: string,
	): Promise<IsolatedRenderResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Try preferred framework first
		try {
			const request: IsolatedRenderRequest = {
				componentPath: "fallback-component",
				component,
				framework: preferredFramework,
			};

			const result = await this.renderWithIsolation(request);
			if (result.success) {
				return result;
			}

			errors.push(...result.errors);
			warnings.push(...result.warnings);
		} catch (error) {
			errors.push(
				`Preferred framework (${preferredFramework}) failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Try fallback frameworks in order of preference
		const fallbackOrder = ["preact", "unknown"];

		for (const fallbackFramework of fallbackOrder) {
			if (fallbackFramework === preferredFramework) {
				continue; // Already tried
			}

			try {
				const request: IsolatedRenderRequest = {
					componentPath: "fallback-component",
					component,
					framework: fallbackFramework,
				};

				const result = await this.renderWithIsolation(request);
				if (result.success) {
					warnings.push(`Fell back to ${fallbackFramework} rendering from ${preferredFramework}`);
					return {
						...result,
						warnings: [...warnings, ...result.warnings],
					};
				}

				errors.push(...result.errors);
			} catch (error) {
				errors.push(
					`Fallback framework (${fallbackFramework}) failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// All frameworks failed, return error result
		return {
			html: "",
			framework: preferredFramework,
			success: false,
			errors,
			warnings,
		};
	}

	/**
	 * Validates that a framework context is properly set up
	 */
	async validateFrameworkContext(framework: string): Promise<boolean> {
		const context = this.contexts.get(framework);
		if (!context) {
			return false;
		}

		try {
			// Try to set up the framework environment
			await this.setupFrameworkEnvironment(framework);
			return true;
		} catch (error) {
			if (this.config.debugLogging) {
				console.warn(
					`[SSR Isolation] Framework context validation failed for ${framework}:`,
					error,
				);
			}
			return false;
		}
	}

	/**
	 * Gets framework-specific error recovery strategies
	 */
	getErrorRecoveryStrategies(framework: string): string[] {
		const strategies: Record<string, string[]> = {
			solid: [
				"Ensure solid-js and solid-js/web are installed",
				"Name Solid islands *.solid.tsx so Avalon selects the solid-js JSX runtime",
				"Verify Solid components export default function",
			],
			vue: [
				"Ensure vue and vue/server-renderer are installed",
				"Check that Vue components have proper <template>, <script>, and <style> sections",
				"Verify Vue components are properly compiled for SSR",
			],
			svelte: [
				"Ensure svelte is installed and components are compiled",
				"Check that Svelte components export default class or function",
				"Verify Svelte components have proper script and style sections",
			],
			preact: [
				"Ensure preact and preact-render-to-string are installed",
				"Name Preact islands *.tsx (or *.preact.tsx) so Avalon selects the preact JSX runtime",
				"Verify Preact components export default function",
			],
		};

		return (
			strategies[framework] || [
				"Check that the framework is properly installed",
				"Verify component syntax is correct for the detected framework",
				"Consider adding explicit framework detection hints",
			]
		);
	}
}
