export type PackageManager = "bun" | "npm" | "pnpm" | "yarn" | "yarn-classic";

export interface PackageManagerCommands {
	install: string;
	run: (script: string) => string;
	exec: (pkg: string) => string;
}

/**
 * Which installer launched create-avalon.
 * `npm_config_user_agent` is set by npm, pnpm, yarn, and bun (`bun/1.x npm/? …`).
 */
export function detectPackageManager(
	userAgent = process.env.npm_config_user_agent ?? "",
	bunRuntime = typeof process.versions.bun === "string",
): PackageManager {
	const ua = userAgent.toLowerCase();
	if (/\bpnpm\//.test(ua)) return "pnpm";
	if (/\byarn\//.test(ua)) {
		const major = Number(/\byarn\/(\d+)/.exec(ua)?.[1] ?? "1");
		return major >= 2 ? "yarn" : "yarn-classic";
	}
	if (/\bbun\//.test(ua)) return "bun";
	if (/\bnpm\//.test(ua)) return "npm";
	return bunRuntime ? "bun" : "npm";
}

/** Yarn Berry version from the user agent (`yarn/4.5.0 …`), for Corepack `packageManager`. */
export function detectPackageManagerVersion(
	userAgent = process.env.npm_config_user_agent ?? "",
): string | undefined {
	if (detectPackageManager(userAgent, false) !== "yarn") return undefined;
	return /\byarn\/(\S+)/i.exec(userAgent)?.[1];
}

export function commandsFor(pm: PackageManager): PackageManagerCommands {
	switch (pm) {
		case "npm":
			return {
				install: "npm install",
				run: (script) => `npm run ${script}`,
				exec: (pkg) => `npx ${pkg}`,
			};
		case "pnpm":
			return {
				install: "pnpm install",
				run: (script) => `pnpm run ${script}`,
				exec: (pkg) => `pnpm dlx ${pkg}`,
			};
		case "yarn":
			return {
				install: "yarn",
				run: (script) => `yarn ${script}`,
				exec: (pkg) => `yarn dlx ${pkg}`,
			};
		case "yarn-classic":
			return {
				install: "yarn",
				run: (script) => `yarn ${script}`,
				exec: (pkg) => `npx ${pkg}`,
			};
		case "bun":
			return {
				install: "bun install",
				run: (script) => `bun run ${script}`,
				exec: (pkg) => `bunx ${pkg}`,
			};
	}
}

export function packageManagerOf(config: { packageManager?: PackageManager }): PackageManager {
	return config.packageManager ?? detectPackageManager();
}
