import type { ServerIslandProp } from "../server-islands/types.ts";

/**
 * Type augmentation for the `island` prop on island components.
 *
 * When importing a component from the islands directory and using it in a page,
 * you can pass an `island` prop to control hydration behavior. The Vite transform
 * plugin intercepts this at build time and converts it to a renderIsland() call.
 *
 * Usage:
 *   import Counter from '../islands/Counter.tsx';
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
	 * Stable identifier for the island instance.
	 * Used for state persistence with PersistentIsland.
	 * If omitted, Avalon generates one automatically from the component path.
	 */
	id?: string;

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
};
