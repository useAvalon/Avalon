/**
 * Framework HMR Adapter Interface
 *
 * Defines the contract for framework-specific HMR adapters.
 * Each supported framework (React, Preact, Vue, Svelte, Solid, Lit) implements this interface
 * to provide framework-specific hot module replacement behavior.
 *
 * Requirements: 2.1-2.7
 */

/// <reference lib="dom" />

/**
 * State snapshot for preserving component state across HMR updates
 */
export interface StateSnapshot {
	/**
	 * Framework name (e.g., 'react', 'vue', 'svelte')
	 */
	framework: string;

	/**
	 * Timestamp when state was captured
	 */
	timestamp: number;

	/**
	 * Framework-specific state data
	 * - React: hooks state, context values
	 * - Vue: reactive data, computed properties
	 * - Svelte: component state, store subscriptions
	 * - Solid: signal values, reactive computations
	 * - Lit: element properties, attributes
	 */
	data: Record<string, unknown>;

	/**
	 * DOM state (scroll, focus, form values)
	 */
	dom?: {
		scrollPosition?: { x: number; y: number };
		focusedElement?: string;
		formValues?: Record<string, unknown>;
	};
}

/**
 * Framework-specific HMR adapter interface
 *
 * Each framework adapter implements this interface to provide:
 * - Component identification (canHandle)
 * - State preservation (preserveState, restoreState)
 * - Hot updates (update)
 * - Error handling (handleError)
 */
export interface FrameworkHMRAdapter {
	/**
	 * Framework name (e.g., 'react', 'preact', 'vue', 'svelte', 'solid', 'lit')
	 */
	readonly name: string;

	/**
	 * Check if this adapter can handle HMR for a given component
	 *
	 * @param component - The component to check
	 * @returns true if this adapter can handle the component
	 *
	 * Example:
	 * - React: Check for React.Component or function with hooks
	 * - Vue: Check for Vue component options object
	 * - Svelte: Check for Svelte component class
	 */
	canHandle(component: unknown): boolean;

	/**
	 * Preserve component state before HMR update
	 *
	 * Captures the current state of the component so it can be restored after update.
	 * Returns null if state preservation is not supported or fails.
	 *
	 * @param island - The island DOM element containing the component
	 * @returns State snapshot or null if preservation fails
	 *
	 * Requirements: 1.3, 4.1-4.5
	 */
	preserveState(island: HTMLElement): StateSnapshot | null;

	/**
	 * Update the component with a new module
	 *
	 * Performs the actual hot module replacement:
	 * - Unmounts old component (if needed)
	 * - Mounts new component with same props
	 * - Integrates with framework-specific HMR APIs
	 *
	 * @param island - The island DOM element
	 * @param newComponent - The new component class/function
	 * @param props - Component props
	 *
	 * Requirements: 2.1-2.6
	 */
	update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void>;

	/**
	 * Restore component state after HMR update
	 *
	 * Applies the previously captured state to the updated component.
	 * Should handle cases where state structure has changed.
	 *
	 * @param island - The island DOM element
	 * @param state - Previously captured state snapshot
	 *
	 * Requirements: 1.3, 4.1-4.5
	 */
	restoreState(island: HTMLElement, state: StateSnapshot): void;

	/**
	 * Handle errors during HMR update
	 *
	 * Provides framework-specific error handling:
	 * - Display error overlay
	 * - Preserve SSR HTML as fallback
	 * - Log diagnostic information
	 *
	 * @param island - The island DOM element
	 * @param error - The error that occurred
	 *
	 * Requirements: 1.4, 7.1-7.5
	 */
	handleError(island: HTMLElement, error: Error): void;
}

/**
 * Adapter registry for managing framework-specific HMR adapters
 */
export class AdapterRegistry {
	private adapters: Map<string, FrameworkHMRAdapter> = new Map();

	/**
	 * Register a framework-specific HMR adapter
	 *
	 * @param framework - Framework name (case-insensitive)
	 * @param adapter - The adapter implementation
	 * @throws Error if adapter is invalid or already registered
	 *
	 * Requirements: 2.1-2.7
	 */
	register(framework: string, adapter: FrameworkHMRAdapter): void {
		const normalizedName = framework.toLowerCase();

		// Validate adapter
		if (!adapter) {
			throw new Error(`Cannot register null/undefined adapter for framework: ${framework}`);
		}

		if (!adapter.name) {
			throw new Error(`Adapter for framework ${framework} must have a name property`);
		}

		if (typeof adapter.canHandle !== 'function') {
			throw new Error(`Adapter for framework ${framework} must implement canHandle method`);
		}

		if (typeof adapter.preserveState !== 'function') {
			throw new Error(`Adapter for framework ${framework} must implement preserveState method`);
		}

		if (typeof adapter.update !== 'function') {
			throw new Error(`Adapter for framework ${framework} must implement update method`);
		}

		if (typeof adapter.restoreState !== 'function') {
			throw new Error(`Adapter for framework ${framework} must implement restoreState method`);
		}

		if (typeof adapter.handleError !== 'function') {
			throw new Error(`Adapter for framework ${framework} must implement handleError method`);
		}

		// Check if already registered
		if (this.adapters.has(normalizedName)) {
			console.warn(`Overwriting existing HMR adapter for framework: ${framework}`);
		}

		this.adapters.set(normalizedName, adapter);
	}

	/**
	 * Get an adapter for a specific framework
	 *
	 * @param framework - Framework name (case-insensitive)
	 * @returns The adapter or undefined if not found
	 */
	get(framework: string): FrameworkHMRAdapter | undefined {
		return this.adapters.get(framework.toLowerCase());
	}

	/**
	 * Check if an adapter is registered for a framework
	 *
	 * @param framework - Framework name (case-insensitive)
	 * @returns true if adapter is registered
	 */
	has(framework: string): boolean {
		return this.adapters.has(framework.toLowerCase());
	}

	/**
	 * Get all registered framework names
	 *
	 * @returns Array of registered framework names
	 */
	getRegisteredFrameworks(): string[] {
		return Array.from(this.adapters.keys());
	}

	/**
	 * Find an adapter that can handle a specific component
	 *
	 * Iterates through all registered adapters and returns the first one
	 * that can handle the component.
	 *
	 * @param component - The component to check
	 * @returns The adapter that can handle the component, or undefined
	 */
	findAdapter(component: unknown): FrameworkHMRAdapter | undefined {
		for (const adapter of this.adapters.values()) {
			if (adapter.canHandle(component)) {
				return adapter;
			}
		}
		return undefined;
	}

	/**
	 * Unregister an adapter
	 *
	 * @param framework - Framework name (case-insensitive)
	 * @returns true if adapter was removed, false if not found
	 */
	unregister(framework: string): boolean {
		const normalizedName = framework.toLowerCase();
		const removed = this.adapters.delete(normalizedName);

		return removed;
	}

	/**
	 * Clear all registered adapters
	 */
	clear(): void {
		this.adapters.clear();
	}

	/**
	 * Get the number of registered adapters
	 */
	get size(): number {
		return this.adapters.size;
	}
}

/**
 * Base adapter class with common functionality
 *
 * Framework-specific adapters can extend this class to inherit common behavior
 * and only override framework-specific methods.
 */
export abstract class BaseFrameworkAdapter implements FrameworkHMRAdapter {
	abstract readonly name: string;

	abstract canHandle(component: unknown): boolean;

	abstract update(island: HTMLElement, newComponent: unknown, props: Record<string, unknown>): Promise<void>;

	/**
	 * Default state preservation implementation
	 * Captures DOM state (scroll, focus, form values)
	 *
	 * Subclasses should override to add framework-specific state
	 */
	preserveState(island: HTMLElement): StateSnapshot | null {
		try {
			const snapshot: StateSnapshot = {
				framework: this.name,
				timestamp: Date.now(),
				data: {},
				dom: this.captureDOMState(island),
			};

			return snapshot;
		} catch (error) {
			console.warn(`Failed to preserve state for ${this.name}:`, error);
			return null;
		}
	}

	/**
	 * Default state restoration implementation
	 * Restores DOM state (scroll, focus, form values)
	 *
	 * Subclasses should override to add framework-specific state restoration
	 */
	restoreState(island: HTMLElement, state: StateSnapshot): void {
		try {
			if (state.dom) {
				this.restoreDOMState(island, state.dom);
			}
		} catch (error) {
			console.warn(`Failed to restore state for ${this.name}:`, error);
		}
	}

	/**
	 * Default error handling implementation
	 * Shows error indicator and preserves SSR HTML
	 */
	handleError(island: HTMLElement, error: Error): void {
		console.error(`HMR error in ${this.name} island:`, error);

		// Add error indicator
		const errorIndicator = document.createElement('div');
		errorIndicator.className = 'hmr-error-indicator';
		errorIndicator.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: #ff4444;
      color: white;
      padding: 8px;
      font-size: 12px;
      font-family: monospace;
      z-index: 10000;
      border-bottom: 2px solid #cc0000;
    `;
		errorIndicator.textContent = `HMR Error: ${error.message}`;

		// Remove existing error indicators
		const existing = island.querySelector('.hmr-error-indicator');
		if (existing) {
			existing.remove();
		}

		island.style.position = 'relative';
		island.insertBefore(errorIndicator, island.firstChild);

		// Mark island as having error
		island.setAttribute('data-hmr-error', 'true');
		island.setAttribute('data-hmr-error-message', error.message);
	}

	/**
	 * Capture DOM state (scroll, focus, form values)
	 */
	protected captureDOMState(island: HTMLElement): StateSnapshot['dom'] {
		const dom: StateSnapshot['dom'] = {};

		// Capture scroll position
		const scrollableElements = island.querySelectorAll('[data-preserve-scroll]');
		if (scrollableElements.length > 0 || island.scrollTop > 0 || island.scrollLeft > 0) {
			dom.scrollPosition = {
				x: island.scrollLeft,
				y: island.scrollTop,
			};
		}

		// Capture focused element
		const activeElement = document.activeElement;
		if (activeElement && island.contains(activeElement)) {
			const selector = this.getElementSelector(activeElement as HTMLElement);
			if (selector) {
				dom.focusedElement = selector;
			}
		}

		// Capture form values
		const formElements = island.querySelectorAll('input, textarea, select');
		if (formElements.length > 0) {
			dom.formValues = {};
			formElements.forEach((element, index) => {
				const input = element as HTMLInputElement;
				const name = input.name || input.id || `element-${index}`;

				if (input.type === 'checkbox' || input.type === 'radio') {
					dom.formValues![name] = input.checked;
				} else {
					dom.formValues![name] = input.value;
				}
			});
		}

		return dom;
	}

	/**
	 * Restore DOM state (scroll, focus, form values)
	 */
	protected restoreDOMState(island: HTMLElement, dom: StateSnapshot['dom']): void {
		if (!dom) return;

		// Restore scroll position
		if (dom.scrollPosition) {
			island.scrollLeft = dom.scrollPosition.x;
			island.scrollTop = dom.scrollPosition.y;
		}

		// Restore focused element
		if (dom.focusedElement) {
			try {
				const element = island.querySelector(dom.focusedElement) as HTMLElement;
				if (element && typeof element.focus === 'function') {
					element.focus();
				}
			} catch (error) {
				console.warn('Failed to restore focus:', error);
			}
		}

		// Restore form values
		if (dom.formValues) {
			const formElements = island.querySelectorAll('input, textarea, select');
			formElements.forEach((element, index) => {
				const input = element as HTMLInputElement;
				const name = input.name || input.id || `element-${index}`;
				const value = dom.formValues![name];

				if (value !== undefined) {
					if (input.type === 'checkbox' || input.type === 'radio') {
						input.checked = value as boolean;
					} else {
						input.value = value as string;
					}
				}
			});
		}
	}

	/**
	 * Get a CSS selector for an element
	 */
	protected getElementSelector(element: HTMLElement): string | null {
		if (element.id) {
			return `#${element.id}`;
		}

		// Check if element has name attribute (for form elements)
		const nameAttr = element.getAttribute('name');
		if (nameAttr) {
			return `[name="${nameAttr}"]`;
		}

		// Fallback to nth-child selector
		const parent = element.parentElement;
		if (parent) {
			const index = Array.from(parent.children).indexOf(element);
			return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
		}

		return null;
	}
}
