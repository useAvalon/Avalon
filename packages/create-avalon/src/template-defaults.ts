import type { ProjectConfig } from "./types";
import { projectTemplate } from "./types";

/** Template-specific defaults applied after CLI flags or prompts. */
export function applyTemplateDefaults(config: ProjectConfig): ProjectConfig {
	if (projectTemplate(config) !== "storefront") {
		return config;
	}

	// Atelier Kō styling is Tailwind 4 + design tokens in storefront-theme.css.
	if (config.styling === "css-modules") {
		return { ...config, styling: "tailwind" };
	}

	return config;
}
