import type { ProjectConfig } from '../types';

export function generateRootLayout(config: ProjectConfig): string {
  const imports: string[] = [];

  imports.push(`import type { LayoutProps } from '@useavalon/avalon';`);

  if (config.styling === 'css-modules') {
    imports.push(`import '../styles/main.css';`);
  } else {
    imports.push(`import '../styles/main.css';`);
  }

  return `${imports.join('\n')}

export default async function RootLayout({ children }: Readonly<LayoutProps>) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${config.projectName}</title>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
`;
}

export function generateHomeLayout(config: ProjectConfig): string {
  return `import type { LayoutProps } from '@useavalon/avalon';

export default async function HomeLayout({ children }: Readonly<LayoutProps>) {
  return <>{children}</>;
}
`;
}
