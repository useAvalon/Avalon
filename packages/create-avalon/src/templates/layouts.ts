import type { ProjectConfig } from "../types";
import { projectTemplate } from "../types";
import { escapeEmbeddedJsString } from "./escape";

export function generateRootLayout(config: ProjectConfig): string {
	const imports: string[] = [];

	imports.push(`import type { LayoutProps } from '@useavalon/avalon';`);
	if (projectTemplate(config) === "blog") {
		imports.push(`import SiteNav from '../components/SiteNav.tsx';`);
	}

	const safeName = escapeEmbeddedJsString(config.projectName);

	return `${imports.join("\n")}

export default async function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
  const title = typeof frontmatter?.title === 'string' ? frontmatter.title : '${safeName}';
  const description = typeof frontmatter?.description === 'string' ? frontmatter.description : '';

  return (
    <html lang="en"${projectTemplate(config) === "blog" ? ' class="blog-theme"' : ""}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/syntax-highlighting.css" />
        ${
					projectTemplate(config) === "blog"
						? `<link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />`
						: ""
				}
      </head>
      <body>
        ${projectTemplate(config) === "blog" ? "<SiteNav />\n        " : ""}{children}
      </body>
    </html>
  );
}
`;
}

export function generateAboutLayout(_config: ProjectConfig): string {
	return `import type { LayoutProps } from '@useavalon/avalon';

export default async function AboutLayout({ children }: Readonly<LayoutProps>) {
  return <>{children}</>;
}
`;
}
