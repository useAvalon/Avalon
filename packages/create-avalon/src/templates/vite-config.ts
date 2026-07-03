import type { ProjectConfig } from "../types";

export function generateViteConfig(config: ProjectConfig): string {
	const imports: string[] = [
		`import { resolve } from 'node:path';`,
		`import { defineConfig, type UserConfig } from 'vite';`,
		`import { avalon } from '@useavalon/avalon';`,
	];

	// Tailwind import
	const needsTailwind = config.styling === "tailwind" || config.styling === "shadcn";
	if (needsTailwind) {
		imports.push(`import tailwindcss from '@tailwindcss/vite';`);
	}

	// SEO plugin import (always included)
	const hasSeo = config.plugins.includes("seo");
	if (hasSeo) {
		imports.push(`import { seo } from '@useavalon/seo';`);
	}

	// Agent optimization import
	const hasAgentOptimization = config.plugins.includes("agent-optimization");
	if (hasAgentOptimization) {
		imports.push(`import { agentOptimization } from '@useavalon/agent-optimization';`);
	}

	// Build integrations array — only user-selected integrations
	const integrationsList = config.integrations.map((i) => `'${i}'`).join(", ");

	// Build plugins array
	const pluginEntries: string[] = [];

	if (hasSeo) {
		pluginEntries.push(`    seo({
      siteUrl: 'http://localhost:3000',
      siteName: '${config.projectName.replace(/'/g, "\\'")}',
      defaultDescription: 'Built with Avalon',
      defaultOgImage: {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
      breadcrumbs: true,
      speakable: true,
    }),`);
	}

	if (hasAgentOptimization) {
		pluginEntries.push(`    agentOptimization({
      sitemap: { siteUrl: 'http://localhost:3000' },
      markdown: true,
      llms: {
        siteUrl: 'http://localhost:3000',
        siteName: '${config.projectName.replace(/'/g, "\\'")}',
        siteDescription: 'Built with Avalon',
        sections: { 'Pages': ['/'] },
      },
    }),`);
	}

	pluginEntries.push(`    ...avalonPlugins,`);

	if (needsTailwind) {
		pluginEntries.push(`    tailwindcss(),`);
	}

	const lines = [
		imports.join("\n"),
		"",
		`export default defineConfig(async (): Promise<UserConfig> => {`,
		`  const avalonPlugins = await avalon({`,
		`    core: '${config.core}',`,
		`    integrations: [${integrationsList}],`,
		`    modules: 'app/modules',`,
		`    layoutsDir: 'app/shared/layouts',`,
		`    image: true,`,
		`    nitro: {`,
		`      preset: process.env.NITRO_PRESET || 'node_server',`,
		`      streaming: true,`,
		`      clientEntry: 'app/entry-client',`,
		`      globalCSS: ['app/shared/styles/main.css'],`,
		`      prerender: {`,
		`        routes: ['/'],`,
		`        crawlLinks: true,`,
		`        ignore: [],`,
		`      },`,
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
