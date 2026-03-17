import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectConfig } from './types';
import { BASE_DIRS } from './types';
import { generatePackageJson } from './templates/package-json';
import { generateTsConfig } from './templates/tsconfig';
import { generateViteConfig } from './templates/vite-config';
import { generateRootLayout, generateHomeLayout } from './templates/layouts';
import { generateHomePage } from './templates/pages';
import { generateSampleMiddleware } from './templates/middleware';
import { generateHelloRoute } from './templates/api-routes';
import { generateStylingFiles } from './templates/styling';

export async function scaffoldProject(config: ProjectConfig, targetDir: string): Promise<void> {
  // Create the target directory
  await mkdir(targetDir, { recursive: true });

  // Create all base directories
  for (const dir of BASE_DIRS) {
    await mkdir(join(targetDir, dir), { recursive: true });
  }

  // Generate and write core config files
  await writeFile(join(targetDir, 'package.json'), generatePackageJson(config));
  await writeFile(join(targetDir, 'tsconfig.json'), generateTsConfig());
  await writeFile(join(targetDir, 'vite.config.ts'), generateViteConfig(config));

  // Generate and write layout and page files
  await writeFile(join(targetDir, 'app/shared/layouts/_layout.tsx'), generateRootLayout(config));
  await writeFile(join(targetDir, 'app/modules/home/layouts/_layout.tsx'), generateHomeLayout(config));
  await writeFile(join(targetDir, 'app/modules/home/pages/index.tsx'), generateHomePage(config));

  // Generate and write middleware and API route
  await writeFile(join(targetDir, 'middleware/01.logger.ts'), generateSampleMiddleware(config));
  await writeFile(join(targetDir, 'routes/api/hello.ts'), generateHelloRoute(config));

  // Generate and write styling files
  const stylingFiles = generateStylingFiles(config);
  for (const [filePath, content] of stylingFiles) {
    await writeFile(join(targetDir, filePath), content);
  }

  // Write empty favicon placeholder
  await writeFile(join(targetDir, 'public/favicon.ico'), '');

  // Write server env.d.ts
  await writeFile(
    join(targetDir, 'server/env.d.ts'),
    `/// <reference types="nitro" />\n`,
  );
}
