import type { ProjectConfig } from "../types";
import { EXAMPLE_CRON_HANDLER, EXAMPLE_CRON_SCHEDULE } from "./cron";

const DEV_SITE_URL = "http://localhost:3000";

function escapeForSingleQuotedJs(value: string): string {
	return value.replaceAll("'", String.raw`\'`);
}

function buildSeoPluginEntry(projectName: string): string {
	const siteName = escapeForSingleQuotedJs(projectName);
	return `    seo({
      siteUrl: '${DEV_SITE_URL}',
      siteName: '${siteName}',
      defaultDescription: 'Built with Avalon',
      defaultOgImage: {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
      breadcrumbs: true,
      speakable: true,
    }),`;
}

function buildAgentOptimizationEntry(projectName: string): string {
	const siteName = escapeForSingleQuotedJs(projectName);
	return `    agentOptimization({
      sitemap: { siteUrl: '${DEV_SITE_URL}' },
      markdown: true,
      llms: {
        siteUrl: '${DEV_SITE_URL}',
        siteName: '${siteName}',
        siteDescription: 'Built with Avalon',
        sections: { 'Pages': ['/'] },
      },
    }),`;
}

export function generateViteConfig(config: ProjectConfig): string {
	const imports: string[] = [
		`import { resolve } from 'node:path';`,
		`import { defineConfig } from 'vite';`,
		`import { avalon } from '@useavalon/avalon';`,
	];

	const needsTailwind = config.styling === "tailwind" || config.styling === "shadcn";
	if (needsTailwind) {
		imports.push(`import tailwindcss from '@tailwindcss/vite';`);
	}

	const hasSeo = config.plugins.includes("seo");
	if (hasSeo) {
		imports.push(`import { seo } from '@useavalon/seo';`);
	}

	const hasAgentOptimization = config.plugins.includes("agent-optimization");
	if (hasAgentOptimization) {
		imports.push(`import { agentOptimization } from '@useavalon/agent-optimization';`);
	}

	const integrationsList = config.integrations.map((i) => `'${i}'`).join(", ");

	const pluginEntries: string[] = [];
	if (hasSeo) {
		pluginEntries.push(buildSeoPluginEntry(config.projectName));
	}
	if (hasAgentOptimization) {
		pluginEntries.push(buildAgentOptimizationEntry(config.projectName));
	}
	pluginEntries.push(`    ...avalonPlugins,`);
	if (needsTailwind) {
		pluginEntries.push(`    tailwindcss(),`);
	}

	const cronLines = config.cron
		? [
				`      // Scheduled jobs (cron). Each entry maps a schedule to a task file`,
				`      // in tasks/. See https://useavalon.dev/docs/cron-jobs`,
				`      cron: [`,
				`        { schedule: '${EXAMPLE_CRON_SCHEDULE}', handler: '${EXAMPLE_CRON_HANDLER}' },`,
				`      ],`,
			]
		: [];

	const compatLines =
		config.deploy === "cloudflare" ? [`      compatibilityDate: '2026-09-04',`] : [];

	const lines = [
		imports.join("\n"),
		"",
		`export default defineConfig(async () => {`,
		`  const avalonPlugins = await avalon({`,
		`    core: '${config.core}',`,
		`    integrations: [${integrationsList}],`,
		`    modules: 'app/modules',`,
		`    layoutsDir: 'app/shared/layouts',`,
		`    image: true,`,
		`    nitro: {`,
		`      preset: process.env.NITRO_PRESET || 'node_server',`,
		`      streaming: true,`,
		...compatLines,
		`      clientEntry: 'app/entry-client',`,
		`      globalCSS: ['app/shared/styles/main.css'],`,
		`      prerender: {`,
		`        routes: ['/', '/about'],`,
		`        crawlLinks: true,`,
		`        ignore: [],`,
		`      },`,
		...cronLines,
		`    },`,
		`  });`,
		"",
		`  return {`,
		`    environments: {`,
		`      client: {`,
		`        build: {`,
		`          rollupOptions: {`,
		`            input: './app/entry-client.ts',`,
		`          },`,
		`        },`,
		`      },`,
		`      ssr: {`,
		`        build: {`,
		`          rollupOptions: {`,
		`            input: './server/renderer.ts',`,
		`          },`,
		`        },`,
		`      },`,
		`    },`,
		``,
		`    plugins: [`,
		pluginEntries.join("\n"),
		`    ],`,
		``,
		`    resolve: {`,
		`      alias: [`,
		`        { find: '@shared', replacement: resolve('app/shared') },`,
		`        { find: '@modules', replacement: resolve('app/modules') },`,
		`        { find: '@/', replacement: \`\${resolve('app')}/\` },`,
		`      ],`,
		`    },`,
		``,
		`    build: {`,
		`      outDir: 'dist',`,
		`      emptyOutDir: true,`,
		`    },`,
		``,
		`    server: {`,
		`      port: 3000,`,
		`    },`,
		`  };`,
		`});`,
		"",
	];

	return lines.join("\n");
}
