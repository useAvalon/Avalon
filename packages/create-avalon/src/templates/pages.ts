import type { ProjectConfig } from '../types';

export function generateHomePage(config: ProjectConfig): string {
  const imports: string[] = [];
  let titleClass = '';
  let pageClass = '';

  if (config.styling === 'css-modules') {
    imports.push(`import styles from './index.module.css';`);
    pageClass = ' className={styles.page}';
    titleClass = ' className={styles.title}';
  }

  const useTailwind = config.styling === 'tailwind' || config.styling === 'shadcn';
  if (useTailwind) {
    pageClass = ' className="max-w-3xl mx-auto px-4 py-8"';
    titleClass = ' className="text-4xl font-bold mb-4"';
  }

  return `${imports.length > 0 ? imports.join('\n') + '\n' : ''}
export default async function HomePage() {
  return (
    <div${pageClass}>
      <h1${titleClass}>Welcome to ${config.projectName}</h1>
      <p>Get started by editing this page.</p>
    </div>
  );
}
`;
}
