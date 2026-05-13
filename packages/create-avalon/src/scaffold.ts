import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateHelloRoute } from "./templates/api-routes";
import { generateBuildMjs, generateNetlifyToml, generateRobotsTxt } from "./templates/deploy";
import { getFaviconBuffer } from "./templates/favicon";
import { generateMainLayout, generateRootLayout } from "./templates/layouts";
import { generateSampleMiddleware } from "./templates/middleware";
import { generatePackageJson } from "./templates/package-json";
import { generate404Page, generateMainPage } from "./templates/pages";
import { generatePostBuildMjs } from "./templates/post-build";
import { generateStylingFiles } from "./templates/styling";
import { generateEnvDts, generateTsConfig } from "./templates/tsconfig";
import { generateViteConfig } from "./templates/vite-config";
import type { ProjectConfig } from "./types";
import { BASE_DIRS } from "./types";

function generateHonoServerEntry(): string {
	return `import { Hono } from 'hono';

const app = new Hono();

// Add your Hono middleware and routes here.
// This file is the Nitro server entry using the web fetch interface.
// Route files in routes/ still use defineHandler from 'nitro'.

app.use('*', async (c, next) => {
  console.log(\`[\${new Date().toISOString()}] \${c.req.method} \${c.req.path}\`);
  await next();
});

export default app;
`;
}

function generateElysiaServerEntry(): string {
	return `import { Elysia } from 'elysia';

const app = new Elysia();

// Add your Elysia middleware and routes here.
// This file is the Nitro server entry using the web fetch interface.
// Route files in routes/ still use defineHandler from 'nitro'.

app.onBeforeHandle(({ request }) => {
  console.log(\`[\${new Date().toISOString()}] \${request.method} \${new URL(request.url).pathname}\`);
});

export default app;
`;
}

export async function scaffoldProject(config: ProjectConfig, targetDir: string): Promise<void> {
	// Create the target directory
	await mkdir(targetDir, { recursive: true });

	// Create all base directories
	for (const dir of BASE_DIRS) {
		await mkdir(join(targetDir, dir), { recursive: true });
	}

	// Generate and write core config files
	await writeFile(join(targetDir, "package.json"), generatePackageJson(config));
	await writeFile(join(targetDir, "tsconfig.json"), generateTsConfig());
	await writeFile(join(targetDir, "vite.config.ts"), generateViteConfig(config));

	// Generate and write layout and page files
	await writeFile(join(targetDir, "app/shared/layouts/_layout.tsx"), generateRootLayout(config));
	await writeFile(
		join(targetDir, "app/modules/main/layouts/_layout.tsx"),
		generateMainLayout(config),
	);
	await writeFile(join(targetDir, "app/modules/main/pages/index.tsx"), generateMainPage(config));
	await writeFile(join(targetDir, "app/modules/main/pages/404.tsx"), generate404Page());

	// Generate and write middleware and API route
	await writeFile(join(targetDir, "middleware/01.logger.ts"), generateSampleMiddleware(config));
	await writeFile(join(targetDir, "routes/api/hello.ts"), generateHelloRoute(config));

	// When using hono or elysia, generate a server.ts entry file (Nitro v3 web fetch interface)
	if (config.middleware === "hono") {
		await writeFile(join(targetDir, "server.ts"), generateHonoServerEntry());
	} else if (config.middleware === "elysia") {
		await writeFile(join(targetDir, "server.ts"), generateElysiaServerEntry());
	}

	// Generate and write styling files
	const stylingFiles = generateStylingFiles(config);
	for (const [filePath, content] of stylingFiles) {
		await mkdir(join(targetDir, dirname(filePath)), { recursive: true });
		await writeFile(join(targetDir, filePath), content);
	}

	// Write Avalon favicon
	await writeFile(join(targetDir, "public/favicon.ico"), getFaviconBuffer());

	// Write robots.txt with AI crawler rules
	await writeFile(join(targetDir, "public/robots.txt"), generateRobotsTxt());

	// Write server env.d.ts
	await writeFile(join(targetDir, "server/env.d.ts"), `/// <reference types="nitro" />\n`);

	// Write app env.d.ts — island prop types, virtual module declarations
	await writeFile(join(targetDir, "app/env.d.ts"), generateEnvDts(config.integrations));

	// Write server/renderer.ts — Nitro SSR catch-all handler
	await writeFile(
		join(targetDir, "server/renderer.ts"),
		[
			`/**`,
			` * SSR Renderer — provided by Avalon's virtual module system.`,
			` *`,
			` * Avalon auto-discovers layouts, injects client assets, and handles`,
			` * layout wrapping. Import from the virtual modules directly to customize:`,
			` *`,
			` *   import { wrapWithLayouts } from 'virtual:avalon/layouts';`,
			` *   import { injectAssets } from 'virtual:avalon/assets';`,
			` */`,
			`export { default } from 'virtual:avalon/renderer';`,
			``,
		].join("\n"),
	);

	// Write deployment files
	await writeFile(join(targetDir, "build.mjs"), generateBuildMjs());
	await writeFile(join(targetDir, "post-build.mjs"), generatePostBuildMjs());
	if (config.deploy === "netlify") {
		await writeFile(join(targetDir, "netlify.toml"), generateNetlifyToml(config));
	}
}
