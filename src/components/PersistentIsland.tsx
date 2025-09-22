import { h, Component } from 'preact';
import type { ComponentChildren } from 'preact';
import type { PersistentIslandProps, IslandState } from '../schemas/layout.ts';
import { PersistentIslandProvider } from '../core/islands/persistent-island-context.ts';
import { defaultIslandPersistence } from '../core/islands/island-persistence.ts';
import Island from '../islands/island.tsx';

/**
 * State interface for PersistentIsland component
 */
interface PersistentIslandState {
	islandState: IslandState | null;
	isLoaded: boolean;
	error: Error | null;
}

/**
 * PersistentIsland component wrapper for automatic state management
 *
 * This component wraps regular islands to provide persistent state management
 * across navigation and browser sessions. It automatically saves and restores
 * island state using the configured persistence strategy.
 */
export class PersistentIsland extends Component<
	PersistentIslandProps & {
		src: string;
		condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
		props?: Record<string, unknown>;
		ssr?: boolean;
		framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
		ssrOnly?: boolean;
	},
	PersistentIslandState
> {
	private persistence = defaultIslandPersistence;
	private saveStateTimeout: number | null = null;

	constructor(
		props: PersistentIslandProps & {
			src: string;
			condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
			props?: Record<string, unknown>;
			ssr?: boolean;
			framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
			ssrOnly?: boolean;
		}
	) {
		super(props);

		this.state = {
			islandState: null,
			isLoaded: false,
			error: null,
		};
	}

	/**
	 * Load saved state when component mounts
	 */
	override componentDidMount() {
		this.loadSavedState();

		// Listen for navigation events to save state
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', this.handleBeforeUnload);
			window.addEventListener('pagehide', this.handlePageHide);

			// Listen for popstate (back/forward navigation)
			window.addEventListener('popstate', this.handlePopState);
		}
	}

	/**
	 * Save state before component unmounts
	 */
	override componentWillUnmount() {
		this.saveCurrentState();

		// Clean up event listeners
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', this.handleBeforeUnload);
			window.removeEventListener('pagehide', this.handlePageHide);
			window.removeEventListener('popstate', this.handlePopState);
		}

		// Clear any pending save timeout
		if (this.saveStateTimeout) {
			clearTimeout(this.saveStateTimeout);
		}
	}

	/**
	 * Load saved state from persistence layer
	 */
	private loadSavedState = () => {
		try {
			const savedState = this.persistence.loadState(this.props.persistentId);

			this.setState({
				islandState: savedState,
				isLoaded: true,
				error: null,
			});

			if (savedState) {
				console.log(`Loaded persistent state for island: ${this.props.persistentId}`);
			}
		} catch (error) {
			console.error(`Failed to load persistent state for island ${this.props.persistentId}:`, error);
			this.setState({
				islandState: null,
				isLoaded: true,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	};

	/**
	 * Save current state to persistence layer
	 */
	private saveCurrentState = () => {
		if (!this.state.islandState) {
			return;
		}

		try {
			this.persistence.saveState(this.props.persistentId, this.state.islandState);
			console.log(`Saved persistent state for island: ${this.props.persistentId}`);
		} catch (error) {
			console.error(`Failed to save persistent state for island ${this.props.persistentId}:`, error);
		}
	};

	/**
	 * Debounced state saving to avoid excessive storage operations
	 */
	private debouncedSaveState = (state: IslandState) => {
		// Clear existing timeout
		if (this.saveStateTimeout) {
			clearTimeout(this.saveStateTimeout);
		}

		// Set new timeout
		this.saveStateTimeout = setTimeout(() => {
			this.setState({ islandState: state }, () => {
				this.saveCurrentState();
			});
		}, 300); // 300ms debounce
	};

	/**
	 * Handle browser beforeunload event
	 */
	private handleBeforeUnload = () => {
		this.saveCurrentState();
	};

	/**
	 * Handle browser pagehide event (better for mobile)
	 */
	private handlePageHide = () => {
		this.saveCurrentState();
	};

	/**
	 * Handle browser popstate event (back/forward navigation)
	 */
	private handlePopState = () => {
		// Reload state when navigating back/forward
		this.loadSavedState();
	};

	/**
	 * Update island state (called by child components)
	 */
	updateIslandState = (newState: IslandState) => {
		this.debouncedSaveState(newState);
	};

	/**
	 * Clear persistent state
	 */
	clearPersistentState = () => {
		try {
			this.persistence.clearState(this.props.persistentId);
			this.setState({
				islandState: null,
				error: null,
			});
			console.log(`Cleared persistent state for island: ${this.props.persistentId}`);
		} catch (error) {
			console.error(`Failed to clear persistent state for island ${this.props.persistentId}:`, error);
			this.setState({
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	};

	/**
	 * Check if persistent state exists
	 */
	hasPersistentState = (): boolean => {
		return this.persistence.hasState(this.props.persistentId);
	};

	render() {
		const { persistentId, children, src, condition, props, ssr, framework, ssrOnly, ...otherProps } = this.props;
		const { islandState, isLoaded, error } = this.state;

		// Show loading state while state is being loaded
		if (!isLoaded) {
			return (
				<div class="persistent-island-loading" data-persistent-id={persistentId}>
					Loading persistent island...
				</div>
			);
		}

		// Show error state if there was an error loading state
		if (error) {
			return (
				<div class="persistent-island-error" data-persistent-id={persistentId}>
					<p>Error loading persistent island: {error.message}</p>
					<button onClick={this.clearPersistentState}>Clear State</button>
				</div>
			);
		}

		// Merge persistent state with props
		const enhancedProps = {
			...props,
			persistentState: islandState,
			updatePersistentState: this.updateIslandState,
			clearPersistentState: this.clearPersistentState,
			hasPersistentState: this.hasPersistentState,
		};

		return (
			<PersistentIslandProvider persistentId={persistentId}>
				<div class="persistent-island-wrapper" data-persistent-id={persistentId} data-has-state={islandState !== null}>
					<Island
						src={src}
						condition={condition}
						props={enhancedProps}
						ssr={ssr}
						framework={framework}
						ssrOnly={ssrOnly}
						{...otherProps}>
						{children}
					</Island>
				</div>
			</PersistentIslandProvider>
		);
	}
}

/**
 * Functional component wrapper for easier usage
 */
export default function PersistentIslandWrapper(
	props: PersistentIslandProps & {
		src: string;
		condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
		props?: Record<string, unknown>;
		ssr?: boolean;
		framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
		ssrOnly?: boolean;
		children?: ComponentChildren;
	}
) {
	return h(PersistentIsland, props);
}
