/**
 * Qwik client-side resumability handler
 *
 * Unlike other frameworks, Qwik doesn't hydrate — it resumes.
 * The Qwikloader (~1KB) handles event delegation and lazy-loads
 * component code on demand when events fire.
 *
 * This module provides the Avalon integration layer for Qwik's
 * resumability model within the island architecture.
 */

import type { QwikComponent, QwikResumabilityOptions } from "../types.ts";

/**
 * Resume a server-rendered Qwik component on the client
 *
 * For Qwik, "hydration" is actually resumption — the framework
 * picks up where the server left off using serialized state in the DOM.
 * The Qwikloader script handles this automatically.
 *
 * This function is provided for API consistency with other integrations
 * but delegates to Qwik's native resumability mechanism.
 *
 * @param container - DOM element containing the server-rendered HTML
 * @param Component - Qwik component (used for client-only rendering)
 * @param props - Component props
 * @param _options - Resumability options
 */
export function hydrate(
	container: Element,
	Component: QwikComponent,
	props: Record<string, unknown> = {},
	_options: QwikResumabilityOptions = {},
): void {
	try {
		if (!container) {
			throw new Error("Container element is required for resumption");
		}

		const element = container as HTMLElement;
		const hasSSRContent = element.children.length > 0;
		const hasQwikContainer =
			element.closest(String.raw`[q\:container]`) !== null || element.hasAttribute("q:container");

		if (hasSSRContent && hasQwikContainer) {
			// Qwik container already exists with serialized state.
			// The Qwikloader handles resumption automatically — nothing to do.
			return;
		}

		mount(element, Component, props);
	} catch (error) {
		if (process.env.NODE_ENV !== "production") {
			(container as HTMLElement).dataset.hydrationStatus = "failed";
			const errorMsg = error instanceof Error ? error.message : String(error);
			(container as HTMLElement).dataset.hydrationError = errorMsg;
			console.error(`Qwik resumption setup failed:`, error);
		}
	}
}

/** Client-render a Qwik component into an empty container. */
export function mount(
	container: Element,
	Component: QwikComponent,
	props: Record<string, unknown> = {},
): void {
	const element = container as HTMLElement;
	import("@builder.io/qwik")
		.then((qwik) => {
			const qwikModule = qwik as any;

			try {
				if (qwikModule.render) {
					const jsxNode =
						typeof qwikModule.jsx === "function"
							? qwikModule.jsx(Component, props)
							: Component(props);

					qwikModule.render(element, jsxNode);
				} else if (process.env.NODE_ENV !== "production") {
					element.dataset.hydrationStatus = "failed";
					element.dataset.hydrationError = "Qwik render API not available";
				}
			} catch (error) {
				if (process.env.NODE_ENV !== "production") {
					element.dataset.hydrationStatus = "failed";
					const errorMsg = error instanceof Error ? error.message : String(error);
					element.dataset.hydrationError = errorMsg;
					console.error(`Qwik client render failed:`, error);
				}
			}
		})
		.catch((importError) => {
			if (process.env.NODE_ENV !== "production") {
				element.dataset.hydrationStatus = "failed";
				element.dataset.hydrationError = "Failed to load @builder.io/qwik module";
				console.error(`Failed to import @builder.io/qwik:`, importError);
			}
		});
}

/** Qwik resumability has no client tree to tear down. */
export function unmount(_container: HTMLElement): void {
	return;
}

/**
 * Get the resumability script for Qwik components
 *
 * This script finds Qwik islands and ensures the Qwikloader is present.
 * For SSR'd Qwik components, the Qwikloader handles everything automatically.
 * For client-only islands, this script triggers the render.
 *
 * @returns Resumability script as string
 */
export function getHydrationScript(): string {
	return `
    // Qwik resumability script
    (async function() {
      // Find all Qwik islands
      const islands = document.querySelectorAll('[data-framework="qwik"]');

      console.log(\`Found \${islands.length} Qwik island(s)\`);

      for (const island of islands) {
        try {
          // Check if this island has a Qwik container (SSR'd)
          const hasContainer = island.closest('[q\\\\:container]') !== null ||
                                island.hasAttribute('q:container');

          if (hasContainer) {
            // SSR'd Qwik component — Qwikloader handles resumption
            console.log(\`✅ Qwik island resumed: \${island.getAttribute('data-src')}\`);
            continue;
          }

          // Client-only island — needs explicit render
          const src = island.getAttribute('data-src');
          const propsJson = island.getAttribute('data-props');
          const condition = island.getAttribute('data-condition') || 'on:client';

          if (!src) {
            console.warn('Qwik island missing data-src attribute:', island);
            continue;
          }

          let props = {};
          if (propsJson) {
            try {
              props = JSON.parse(propsJson);
            } catch (e) {
              console.error('Failed to parse Qwik island props:', e);
            }
          }

          if (!shouldHydrate(island, condition)) {
            console.log(\`Skipping render for \${src} (condition: \${condition})\`);
            continue;
          }

          const { hydrate } = await import('@useavalon/qwik/client');
          const module = await import(src);
          const Component = module.default || module;

          hydrate(island, Component, props);

          console.log(\`✅ Rendered Qwik island: \${src}\`);
        } catch (error) {
          console.error('Failed to handle Qwik island:', error);
        }
      }
    })();

    function shouldHydrate(element, condition) {
      if (!condition || condition === 'on:client') {
        return true;
      }

      if (condition === 'on:visible') {
        return new Promise(resolve => {
          const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
              observer.disconnect();
              resolve(true);
            }
          });
          observer.observe(element);
        });
      }

      if (condition === 'on:interaction') {
        return new Promise(resolve => {
          const events = ['click', 'mouseenter', 'touchstart', 'focus'];
          const handler = () => {
            events.forEach(e => element.removeEventListener(e, handler));
            resolve(true);
          };
          events.forEach(e => element.addEventListener(e, handler, { once: true }));
        });
      }

      if (condition === 'on:idle') {
        return new Promise(resolve => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(true));
          } else {
            setTimeout(() => resolve(true), 200);
          }
        });
      }

      if (condition.startsWith('media:')) {
        const query = condition.slice(6);
        return window.matchMedia(query).matches;
      }

      return true;
    }
  `;
}
