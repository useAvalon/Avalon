/**
 * Type augmentation for the `island` prop on island components.
 *
 * When using a component in a page with the `island` prop, the Vite transform
 * intercepts it at build time and converts it to a renderIsland() call.
 *
 * Usage:
 *   import Counter from '../components/Counter.tsx';
 *   <Counter island={{ condition: 'on:interaction' }} someProp={42} />
 *
 * Custom directives:
 *   <Counter island={{ condition: 'on:delay' }} />
 *
 * Server islands:
 *   <UserAvatar server={{ fallback: <AvatarSkeleton /> }} userId={session.id} />
 */

export type { ServerIslandProp } from "../server-islands/types.ts";

export type IslandDirective = {
	/**
	 * Hydration condition — controls when the island's JavaScript loads and executes.
	 *
	 * Built-in conditions:
	 * - `on:client` — hydrates immediately on page load
	 * - `on:visible` — hydrates when the element enters the viewport
	 * - `on:interaction` — hydrates on first click or hover
	 * - `on:idle` — hydrates when the browser is idle
	 * - `media:<query>` — hydrates when a CSS media query matches
	 *
	 * Custom conditions:
	 * - `on:<name>` — uses a registered custom hydration directive
	 *
	 * @default 'on:client'
	 */
	condition?:
		| "on:visible"
		| "on:interaction"
		| "on:idle"
		| "on:client"
		| `media:${string}`
		| `on:${string}`;

	/**
	 * Stable HTML `id` for this island instance.
	 * Required when two copies of the same component appear on one page.
	 * If omitted, Avalon generates a unique id from the component path plus an instance counter.
	 */
	id?: string;

	/**
	 * Keep this island's live instance across client navigations.
	 * The value is a stable key matched against the same key on the next page.
	 * `true` uses the component `src` as the key. Qwik islands are never persisted.
	 *
	 * Equivalent markup: `data-router-persist="key"` on a wrapper element.
	 */
	persist?: string | true;

	/**
	 * Optional argument passed to custom hydration directives.
	 * For example, `on:delay` uses this as the delay in milliseconds.
	 *
	 * @example
	 * ```tsx
	 * <Counter island={{ condition: 'on:delay', conditionArg: '5000' }} />
	 * ```
	 */
	conditionArg?: string;

	/**
	 * Skip server rendering of this component. Avalon emits an empty
	 * `<avalon-island>` placeholder and mounts the component in the browser.
	 * Props are still serialized. Combines with `condition` for when to mount.
	 *
	 * @example
	 * ```tsx
	 * <Chart island={{ clientOnly: true }} userId={user.id} />
	 * <Chart island={{ clientOnly: true, condition: 'on:idle' }} />
	 * ```
	 */
	clientOnly?: boolean;
};
