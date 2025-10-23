// Dedicated SolidJS client hydration system
// Based on SolidJS SSR documentation and best practices

class SolidIslandHydrator {
	constructor() {
		this.hydratedIslands = new Set();
		this.pendingHydrations = new Map();
	}

	async init() {
		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			await document.addEventListener('DOMContentLoaded', () => this.findAndHydrateIslands());
		} else {
			await this.findAndHydrateIslands();
		}
	}

	findAndHydrateIslands() {
		const solidContainers = document.querySelectorAll('[data-solid-hydrate]');

		for (const container of solidContainers) {
			const src = container.getAttribute('data-solid-hydrate');
			const condition = container.getAttribute('data-solid-condition') || 'on:client';

			if (!src || this.hydratedIslands.has(container)) {
				continue;
			}

			// Schedule hydration based on condition
			this.scheduleHydration(container, src, condition);
		}
	}

	scheduleHydration(container, src, condition) {
		const hydrateNow = () => {
			if (this.hydratedIslands.has(container)) return;
			this.hydrateContainer(container, src);
		};

		if (condition === 'on:load') {
			console.warn(
				`⚠️ on:load directive is not implemented and has been ignored. Use on:client for immediate hydration instead.`
			);
			return; // Skip hydration for on:load
		}

		switch (condition) {
			case 'on:client':
				hydrateNow();
				break;

			case 'on:visible':
				this.setupVisibilityTrigger(container, hydrateNow);
				break;

			case 'on:interaction':
				this.setupInteractionTrigger(container, hydrateNow);
				break;

			case 'on:idle':
				this.setupIdleTrigger(hydrateNow);
				break;

			default:
				if (condition.startsWith('media:')) {
					this.setupMediaTrigger(condition.slice(6), hydrateNow);
				} else {
					hydrateNow();
				}
		}
	}

	async hydrateContainer(container, src) {
		if (this.hydratedIslands.has(container)) return;

		try {
			console.log(`🏝️ Hydrating Solid island: ${src}`);

			// Mark as hydrated immediately to prevent double hydration
			this.hydratedIslands.add(container);

			// Parse props
			const propsAttr = container.getAttribute('data-solid-props');
			const props = propsAttr ? JSON.parse(propsAttr) : {};

			// Import the island component with fallback
			console.log(`🔄 Importing Solid module: ${src}`);
			const module = await this.importWithFallback(src, 'solid');
			console.log(`🔍 Module imported:`, {
				hasDefault: !!module.default,
				moduleKeys: Object.keys(module),
				defaultType: typeof module.default,
			});

			const SolidComponent = module.default || module;

			if (!SolidComponent || typeof SolidComponent !== 'function') {
				throw new Error(`Invalid Solid component in ${src}. Got: ${typeof SolidComponent}`);
			}

			// Import SolidJS render function with fallback - use render instead of hydrate to avoid SSR mismatch issues
			console.log(`🔄 Importing solid-js/web...`);
			const solidWeb = await this.importWithFallback('solid-js/web', 'solid');
			console.log(`🔍 solid-js/web imported:`, {
				hasRender: !!solidWeb.render,
				hasHydrate: !!solidWeb.hydrate,
				keys: Object.keys(solidWeb),
			});

			const { render } = solidWeb;

			if (!render || typeof render !== 'function') {
				throw new Error(`render function not found in solid-js/web`);
			}

			// Clear the container and render the component fresh
			console.log(`🔄 Clearing container and rendering component...`);
			container.innerHTML = '';

			// Test the component call first
			console.log(`🔄 Testing component call...`);
			const componentResult = SolidComponent(props);
			console.log(`🔍 Component result:`, { type: typeof componentResult, result: componentResult });

			render(() => SolidComponent(props), container);

			console.log(`✅ Solid island hydrated successfully: ${src}`);
		} catch (error) {
			console.error(`❌ Failed to hydrate Solid island ${src}:`, error);
			console.error(`❌ Error stack:`, error.stack);
			this.handleHydrationError(container, src, error);
			this.hydratedIslands.delete(container); // Allow retry
		}
	}

	setupVisibilityTrigger(container, callback) {
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					callback();
					observer.disconnect();
				}
			},
			{ threshold: 0, rootMargin: '100px' }
		);
		observer.observe(container);
	}

	setupInteractionTrigger(container, callback) {
		const events = ['click', 'touchstart', 'mouseover'];

		const handleInteraction = () => {
			callback();
			events.forEach(event => container.removeEventListener(event, handleInteraction));
		};

		events.forEach(event => container.addEventListener(event, handleInteraction, { once: true }));
	}

	setupIdleTrigger(callback) {
		if (globalThis.requestIdleCallback) {
			globalThis.requestIdleCallback(callback);
		} else {
			setTimeout(callback, 200);
		}
	}

	setupMediaTrigger(mediaQuery, callback) {
		const mediaList = globalThis.matchMedia(mediaQuery);

		if (mediaList.matches) {
			callback();
			return;
		}

		const handleMediaChange = event => {
			if (event.matches) {
				callback();
				mediaList.removeEventListener('change', handleMediaChange);
			}
		};

		mediaList.addEventListener('change', handleMediaChange);
	}

	/**
	 * Import module with fallback mechanism for failed dependency loads
	 * Handles port-specific imports and provides retry logic for Solid components
	 */
	async importWithFallback(src, framework, retryCount = 0) {
		const maxRetries = 3;
		const baseDelay = 100; // Base delay in ms
		
		try {
			// Ensure the import path uses the correct base URL
			const resolvedSrc = this.resolveImportPath(src);
			console.log(`🔄 [Solid] Importing module: ${resolvedSrc} (attempt ${retryCount + 1})`);
			
			return await import(resolvedSrc);
		} catch (error) {
			const errorDetails = this.getImportErrorDetails(error, src, framework, resolvedSrc);
			console.warn(`⚠️ [Solid] Import failed for ${src} (attempt ${retryCount + 1}):`, errorDetails);
			
			if (retryCount < maxRetries) {
				// Exponential backoff with jitter
				const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 100;
				console.log(`🔄 [Solid] Retrying import in ${delay}ms...`);
				
				await new Promise(resolve => setTimeout(resolve, delay));
				return this.importWithFallback(src, framework, retryCount + 1);
			}
			
			// Try alternative import strategies
			if (retryCount === maxRetries) {
				console.log(`🔄 [Solid] Trying alternative import strategies for ${src}...`);
				return this.tryAlternativeImport(src, framework);
			}
			
			throw new Error(`Failed to import ${src} after ${maxRetries + 1} attempts: ${errorDetails.message}`);
		}
	}

	/**
	 * Resolve import path to use correct base URL for the current environment
	 */
	resolveImportPath(src) {
		// If it's already an absolute URL, return as-is
		if (src.startsWith('http://') || src.startsWith('https://')) {
			return src;
		}
		
		// For relative paths, ensure they work with the proxy setup
		if (src.startsWith('./') || src.startsWith('../')) {
			return src;
		}
		
		// For absolute paths starting with /, ensure they go through the main server
		// which will proxy to Vite if needed
		if (src.startsWith('/')) {
			return src;
		}
		
		// For bare module names or other paths, prefix with /
		return `/${src}`;
	}

	/**
	 * Get detailed error information for import failures (Solid-specific)
	 */
	getImportErrorDetails(error, originalSrc, framework, resolvedSrc) {
		const details = {
			message: error.message,
			originalPath: originalSrc,
			resolvedPath: resolvedSrc,
			framework: framework,
			errorType: 'unknown',
			suggestions: []
		};
		
		// Analyze error type and provide Solid-specific suggestions
		if (error.message.includes('404') || error.message.includes('Not Found')) {
			details.errorType = 'not_found';
			details.suggestions = [
				`Check if the Solid component exists at: ${resolvedSrc}`,
				`Verify the file has .tsx or .jsx extension for Solid components`,
				`Ensure the Vite dev server is running and serving Solid files`,
				`Check if the component is in the correct islands directory`
			];
		} else if (error.message.includes('solid-js') || error.message.includes('solid/web')) {
			details.errorType = 'solid_dependency';
			details.suggestions = [
				`solid-js dependency not found - check if it's installed`,
				`Verify Vite dependency optimization includes solid-js modules`,
				`Check if solid-js/web is accessible from the client`,
				`Ensure Solid.js version compatibility`
			];
		} else if (error.message.includes('SyntaxError') || error.message.includes('parse')) {
			details.errorType = 'syntax';
			details.suggestions = [
				`Syntax error in Solid component - check JSX syntax`,
				`Verify Solid component uses proper JSX compilation`,
				`Check for TypeScript errors in .tsx files`,
				`Ensure proper Solid.js imports and exports`
			];
		} else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
			details.errorType = 'cors';
			details.suggestions = [
				`CORS issue - check Vite server CORS configuration`,
				`Verify main server can proxy to Vite server`,
				`Check if Solid dependencies are served with correct headers`
			];
		}
		
		return details;
	}

	/**
	 * Try alternative import strategies when standard import fails
	 */
	async tryAlternativeImport(src, framework) {
		const alternatives = [
			// Try with explicit .js extension
			src.endsWith('.js') ? src : `${src}.js`,
			// Try with .tsx extension for TypeScript components
			src.endsWith('.tsx') ? src : `${src}.tsx`,
			// Try with .solid.tsx extension for Solid-specific components
			src.includes('.solid.') ? src : src.replace(/\.(tsx?|jsx?)$/, '.solid.$1'),
		].filter(Boolean);
		
		const errors = [];
		
		for (const altSrc of alternatives) {
			try {
				console.log(`🔄 [Solid] Trying alternative import: ${altSrc}`);
				return await import(this.resolveImportPath(altSrc));
			} catch (error) {
				const errorDetails = this.getImportErrorDetails(error, altSrc, framework, this.resolveImportPath(altSrc));
				console.warn(`⚠️ [Solid] Alternative import failed: ${altSrc}`, errorDetails);
				errors.push({ src: altSrc, error: errorDetails });
			}
		}
		
		// Create comprehensive error message with all attempts
		const errorMessage = `All Solid import strategies failed for ${src}:\n` +
			errors.map(e => `  - ${e.src}: ${e.error.message}`).join('\n') +
			`\n\nSolid-specific suggestions:\n` +
			[...new Set(errors.flatMap(e => e.error.suggestions))].map(s => `  - ${s}`).join('\n');
		
		throw new Error(errorMessage);
	}

	/**
	 * Handle hydration errors with graceful degradation
	 */
	handleHydrationError(container, src, error) {
		const errorId = `solid-hydration-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		// Log comprehensive error information
		console.group(`❌ [Solid] Hydration Error [${errorId}]`);
		console.error(`Component: ${src}`);
		console.error(`Container:`, container);
		console.error(`Error:`, error);
		
		// Log container context for debugging
		const containerInfo = {
			tagName: container.tagName,
			className: container.className,
			id: container.id,
			attributes: Array.from(container.attributes).reduce((acc, attr) => {
				acc[attr.name] = attr.value;
				return acc;
			}, {}),
			innerHTML: container.innerHTML.substring(0, 200) + (container.innerHTML.length > 200 ? '...' : '')
		};
		console.error(`Container Info:`, containerInfo);
		
		// Log Solid-specific debugging info
		const solidInfo = {
			hydratedIslands: this.hydratedIslands.size,
			pendingHydrations: this.pendingHydrations.size,
			solidVersion: this.getSolidVersion(),
			timestamp: new Date().toISOString()
		};
		console.error(`Solid Context:`, solidInfo);
		console.groupEnd();
		
		// Add error class for styling
		container.classList.add('solid-hydration-failed', 'hydration-failed');
		container.setAttribute('data-solid-hydration-error-id', errorId);
		
		// Add error indicator for debugging in development
		if (this.isDevelopment()) {
			const errorIndicator = document.createElement('div');
			errorIndicator.className = 'solid-hydration-error-indicator';
			errorIndicator.style.cssText = `
				position: absolute;
				top: 0;
				right: 0;
				background: #2c4f7c;
				color: white;
				padding: 2px 6px;
				font-size: 10px;
				border-radius: 0 0 0 4px;
				z-index: 9999;
				pointer-events: auto;
				cursor: pointer;
				font-family: monospace;
			`;
			errorIndicator.textContent = `❌ Solid`;
			errorIndicator.title = `Solid hydration failed for ${src}\nClick for details\nError ID: ${errorId}`;
			
			// Add click handler to show detailed error info
			errorIndicator.addEventListener('click', () => {
				this.showSolidErrorDetails(errorId, src, error, containerInfo, solidInfo);
			});
			
			// Position relative if not already positioned
			const computedStyle = window.getComputedStyle(container);
			if (computedStyle.position === 'static') {
				container.style.position = 'relative';
			}
			
			container.appendChild(errorIndicator);
		}
		
		// Dispatch custom event for error tracking
		container.dispatchEvent(new CustomEvent('solid-hydration-error', {
			detail: { 
				errorId,
				src, 
				error: error.message,
				stack: error.stack,
				containerInfo,
				solidInfo
			},
			bubbles: true
		}));
		
		// Try graceful degradation - keep the SSR content but mark it as static
		container.setAttribute('data-solid-hydration-status', 'failed');
		container.setAttribute('data-render-strategy', 'ssr-only');
	}

	/**
	 * Show detailed Solid hydration error information in development
	 */
	showSolidErrorDetails(errorId, src, error, containerInfo, solidInfo) {
		const modal = document.createElement('div');
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.8);
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: monospace;
			font-size: 12px;
		`;
		
		const content = document.createElement('div');
		content.style.cssText = `
			background: #1a1a1a;
			color: #fff;
			padding: 20px;
			border-radius: 8px;
			max-width: 80%;
			max-height: 80%;
			overflow: auto;
			border: 2px solid #2c4f7c;
		`;
		
		content.innerHTML = `
			<h3 style="color: #2c4f7c; margin-top: 0;">🚨 Solid.js Hydration Error</h3>
			<p><strong>Error ID:</strong> ${errorId}</p>
			<p><strong>Component:</strong> ${src}</p>
			<p><strong>Framework:</strong> Solid.js</p>
			<p><strong>Error Message:</strong> ${error.message}</p>
			
			<h4 style="color: #ffa500;">Stack Trace:</h4>
			<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${error.stack || 'No stack trace available'}</pre>
			
			<h4 style="color: #ffa500;">Container Information:</h4>
			<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(containerInfo, null, 2)}</pre>
			
			<h4 style="color: #ffa500;">Solid Context:</h4>
			<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(solidInfo, null, 2)}</pre>
			
			<h4 style="color: #ffa500;">Troubleshooting Tips:</h4>
			<ul style="color: #ccc;">
				<li>Check if the Solid component exports a default function</li>
				<li>Verify solid-js/web is properly installed and accessible</li>
				<li>Ensure the component doesn't have SSR/client-side mismatches</li>
				<li>Check browser console for additional Solid.js warnings</li>
			</ul>
			
			<div style="margin-top: 20px; text-align: center;">
				<button id="close-solid-error-modal" style="
					background: #2c4f7c;
					color: white;
					border: none;
					padding: 10px 20px;
					border-radius: 4px;
					cursor: pointer;
					font-family: monospace;
				">Close</button>
			</div>
		`;
		
		modal.appendChild(content);
		document.body.appendChild(modal);
		
		// Close modal handlers
		const closeModal = () => document.body.removeChild(modal);
		modal.addEventListener('click', (e) => {
			if (e.target === modal) closeModal();
		});
		content.querySelector('#close-solid-error-modal').addEventListener('click', closeModal);
		
		// Close on Escape key
		const handleKeydown = (e) => {
			if (e.key === 'Escape') {
				closeModal();
				document.removeEventListener('keydown', handleKeydown);
			}
		};
		document.addEventListener('keydown', handleKeydown);
	}

	/**
	 * Get Solid.js version for debugging
	 */
	getSolidVersion() {
		try {
			// Try to get version from solid-js package
			return 'unknown';
		} catch {
			return 'not available';
		}
	}

	/**
	 * Check if we're in development mode
	 */
	isDevelopment() {
		return import.meta.env?.DEV || 
			   import.meta.env?.MODE === 'development' || 
			   location.hostname === 'localhost' ||
			   location.hostname === '127.0.0.1';
	}
}

// Initialize SolidJS hydration system
const solidHydrator = new SolidIslandHydrator();
solidHydrator.init();

// HMR support
if (import.meta.hot) {
	import.meta.hot.accept();

	// Re-initialize on HMR
	import.meta.hot.on('vite:afterUpdate', () => {
		solidHydrator.findAndHydrateIslands();
	});
}

export default solidHydrator;
