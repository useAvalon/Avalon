import { Component, ComponentChildren } from 'preact';
import type { IslandState } from '../schemas/layout.ts';
import { PersistentIslandProvider } from '../core/islands/persistent-island-context.tsx';
import { defaultIslandPersistence } from '../core/islands/island-persistence.ts';
import Island from '../islands/island.tsx';

type IslandCondition = 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;

interface PersistentIslandProps {
	persistentId: string;
	src: string;
	condition?: IslandCondition;
	props?: Record<string, unknown>;
	ssr?: boolean;
	framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
	ssrOnly?: boolean;
	children?: ComponentChildren;
}

interface PersistentIslandState {
	islandState: IslandState | null;
	isLoaded: boolean;
	error: Error | null;
}

/**
 * PersistentIsland component — wraps islands with automatic state persistence.
 */
export class PersistentIsland extends Component<PersistentIslandProps, PersistentIslandState> {
	private persistence = defaultIslandPersistence;
	private saveStateTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(props: PersistentIslandProps) {
		super(props);
		this.state = { islandState: null, isLoaded: false, error: null };
	}

	componentDidMount() {
		this.loadSavedState();
		window.addEventListener('beforeunload', this.handleUnload);
		window.addEventListener('pagehide', this.handleUnload);
	}

	componentWillUnmount() {
		this.saveCurrentState();
		window.removeEventListener('beforeunload', this.handleUnload);
		window.removeEventListener('pagehide', this.handleUnload);
		if (this.saveStateTimeout) clearTimeout(this.saveStateTimeout);
	}

	private loadSavedState = () => {
		try {
			const saved = this.persistence.loadState(this.props.persistentId);
			this.setState({ islandState: saved, isLoaded: true, error: null });
		} catch (err) {
			this.setState({ islandState: null, isLoaded: true, error: err instanceof Error ? err : new Error(String(err)) });
		}
	};

	private saveCurrentState = () => {
		if (!this.state.islandState) return;
		try {
			this.persistence.saveState(this.props.persistentId, this.state.islandState);
		} catch (err) {
			console.error(`Failed to save persistent state for island ${this.props.persistentId}:`, err);
		}
	};

	private handleUnload = () => this.saveCurrentState();

	updateIslandState = (newState: IslandState) => {
		if (this.saveStateTimeout) clearTimeout(this.saveStateTimeout);
		this.saveStateTimeout = setTimeout(() => {
			this.setState({ islandState: newState }, () => this.saveCurrentState());
		}, 300);
	};

	clearPersistentState = () => {
		try {
			this.persistence.clearState(this.props.persistentId);
			this.setState({ islandState: null, error: null });
		} catch (err) {
			this.setState({ error: err instanceof Error ? err : new Error(String(err)) });
		}
	};

	render() {
		const { persistentId, children, src, condition, props, ssr, framework, ssrOnly, ...otherProps } = this.props;
		const { islandState, isLoaded, error } = this.state;

		if (!isLoaded) {
			return <div class="persistent-island-loading" data-persistent-id={persistentId}>Loading...</div>;
		}

		if (error) {
			return (
				<div class="persistent-island-error" data-persistent-id={persistentId}>
					<p>Error: {error.message}</p>
					<button onClick={this.clearPersistentState}>Clear State</button>
				</div>
			);
		}

		const enhancedProps = {
			...props,
			persistentState: islandState,
			updatePersistentState: this.updateIslandState,
			clearPersistentState: this.clearPersistentState,
			hasPersistentState: () => this.persistence.hasState(persistentId),
		};

		return (
			<PersistentIslandProvider persistentId={persistentId}>
				<div class="persistent-island-wrapper" data-persistent-id={persistentId} data-has-state={islandState !== null}>
					<Island src={src} condition={condition} props={enhancedProps} ssr={ssr} framework={framework} ssrOnly={ssrOnly} {...otherProps}>
						{children}
					</Island>
				</div>
			</PersistentIslandProvider>
		);
	}
}

export default PersistentIsland;
