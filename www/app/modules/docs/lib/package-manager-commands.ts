export const PACKAGE_MANAGERS = ["bun", "npm", "pnpm", "yarn"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type PackageManagerPreset =
	| "scaffold"
	| "scaffold-and-dev"
	| "install"
	| "dev"
	| "build"
	| "add-avalon-core"
	| "add-package"
	| "add-dev-package";

function lines(
	bun: string[],
	npm: string[],
	pnpm: string[],
	yarn: string[],
): Record<PackageManager, string[]> {
	return { bun, npm, pnpm, yarn };
}

export function commandsForPreset(
	preset: PackageManagerPreset,
	projectName = "my-app",
	packageName = "",
): Record<PackageManager, string[]> {
	switch (preset) {
		case "scaffold":
			return lines(
				[`bun create avalon ${projectName}`],
				[`npm create avalon@latest ${projectName}`],
				[`pnpm create avalon@latest ${projectName}`],
				[`yarn create avalon ${projectName}`],
			);
		case "scaffold-and-dev":
			return lines(
				[`bun create avalon ${projectName}`, `cd ${projectName}`, "bun install", "bun run dev"],
				[
					`npm create avalon@latest ${projectName}`,
					`cd ${projectName}`,
					"npm install",
					"npm run dev",
				],
				[
					`pnpm create avalon@latest ${projectName}`,
					`cd ${projectName}`,
					"pnpm install",
					"pnpm dev",
				],
				[`yarn create avalon ${projectName}`, `cd ${projectName}`, "yarn install", "yarn dev"],
			);
		case "install":
			return lines(
				[`cd ${projectName}`, "bun install"],
				[`cd ${projectName}`, "npm install"],
				[`cd ${projectName}`, "pnpm install"],
				[`cd ${projectName}`, "yarn install"],
			);
		case "dev":
			return lines(["bun run dev"], ["npm run dev"], ["pnpm dev"], ["yarn dev"]);
		case "build":
			return lines(["bun run build"], ["npm run build"], ["pnpm build"], ["yarn build"]);
		case "add-avalon-core":
			return lines(
				["bun add @useavalon/avalon", "bun add -d vite nitro"],
				["npm install @useavalon/avalon", "npm install -D vite nitro"],
				["pnpm add @useavalon/avalon", "pnpm add -D vite nitro"],
				["yarn add @useavalon/avalon", "yarn add -D vite nitro"],
			);
		case "add-package":
		case "add-dev-package": {
			const pkg = packageName.trim();
			if (!pkg) {
				throw new Error(`${preset} preset requires packageName`);
			}
			if (preset === "add-dev-package") {
				return lines(
					[`bun add -d ${pkg}`],
					[`npm install -D ${pkg}`],
					[`pnpm add -D ${pkg}`],
					[`yarn add -D ${pkg}`],
				);
			}
			return lines(
				[`bun add ${pkg}`],
				[`npm install ${pkg}`],
				[`pnpm add ${pkg}`],
				[`yarn add ${pkg}`],
			);
		}
		default: {
			const _exhaustive: never = preset;
			return _exhaustive;
		}
	}
}
