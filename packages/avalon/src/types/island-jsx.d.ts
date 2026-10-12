/**
 * JSX augmentation for the `island` prop.
 *
 * Automatically included via tsconfig.json `compilerOptions.types`.
 *
 * This file must stay ambient (no top-level import/export) so `declare module`
 * augmentations apply when the package is loaded through `compilerOptions.types`.
 */

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type IslandDirective = import("./island-prop.d.ts").IslandDirective;
type ServerIslandProp = import("./island-prop.d.ts").ServerIslandProp;

declare module "preact" {
	// Preact's jsx/jsxs runtime types component props as `Attributes & P`, not
	// `IntrinsicAttributes & P`, so `island` must live on `Attributes` as well.
	interface Attributes {
		island?: Expand<IslandDirective>;
		server?: Expand<ServerIslandProp>;
	}

	namespace JSX {
		interface IntrinsicAttributes {
			island?: Expand<IslandDirective>;
			server?: Expand<ServerIslandProp>;
		}
	}
}

// React 19 exposes the JSX namespace on the `react` module itself (rather than
// the global `JSX`), so `core: "react"` projects need this augmentation.
declare module "react" {
	namespace JSX {
		interface IntrinsicAttributes {
			island?: Expand<IslandDirective>;
			server?: Expand<ServerIslandProp>;
		}
	}
}

declare global {
	namespace JSX {
		interface IntrinsicAttributes {
			island?: Expand<IslandDirective>;
			server?: Expand<ServerIslandProp>;
		}
	}
}

declare module "@vue/runtime-core" {
	interface ComponentCustomProps {
		island?: Expand<IslandDirective>;
		server?: Expand<ServerIslandProp>;
	}
}
