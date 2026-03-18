import { intro, text, multiselect, select, isCancel, cancel } from '@clack/prompts';
import type { Integration, StylingOption, MiddlewareOption, ProjectConfig } from './types';

export async function collectProjectConfig(initialName?: string): Promise<ProjectConfig> {
  intro('create-avalon');

  let projectName = initialName;

  if (!projectName) {
    const nameResult = await text({
      message: 'What is your project name?',
      placeholder: 'my-avalon-app',
      validate(value = '') {
        if (!value.trim()) return 'Project name is required.';
      },
    });

    if (isCancel(nameResult)) {
      cancel('Operation cancelled.');
      process.exit(1);
    }

    projectName = nameResult;
  }

  const integrationsResult = await multiselect({
    message: 'Which integrations would you like to include? (use space to toggle, enter to confirm)',
    options: [
      { value: 'preact', label: 'preact', hint: 'Preact 10' },
      { value: 'react', label: 'react', hint: 'React 19' },
      { value: 'vue', label: 'vue', hint: 'Vue 3' },
      { value: 'svelte', label: 'svelte', hint: 'Svelte 5' },
      { value: 'solid', label: 'solid', hint: 'SolidJS' },
      { value: 'lit', label: 'lit', hint: 'Lit 3' },
      { value: 'qwik', label: 'qwik', hint: 'Qwik' },
    ],
    required: false,
  });

  if (isCancel(integrationsResult)) {
    cancel('Operation cancelled.');
    process.exit(1);
  }

  const stylingResult = await select({
    message: 'Which styling approach would you like to use?',
    options: [
      { value: 'css-modules', label: 'CSS Modules' },
      { value: 'tailwind', label: 'Tailwind CSS' },
      { value: 'shadcn', label: 'shadcn' },
    ],
  });

  if (isCancel(stylingResult)) {
    cancel('Operation cancelled.');
    process.exit(1);
  }

  const pluginsResult = await multiselect({
    message: 'Which plugins would you like to include? (use space to toggle, enter to confirm)',
    options: [
      { value: 'agent-optimization', label: 'agent-optimization', hint: 'LLM/AI optimization' },
    ],
    required: false,
  });

  if (isCancel(pluginsResult)) {
    cancel('Operation cancelled.');
    process.exit(1);
  }

  const middlewareResult = await select({
    message: 'Which middleware framework would you like to use?',
    options: [
      { value: 'h3', label: 'h3' },
      { value: 'hono', label: 'hono' },
      { value: 'elysia', label: 'elysia' },
    ],
  });

  if (isCancel(middlewareResult)) {
    cancel('Operation cancelled.');
    process.exit(1);
  }

  return {
    projectName,
    integrations: integrationsResult as Integration[],
    styling: stylingResult as StylingOption,
    plugins: pluginsResult,
    middleware: middlewareResult as MiddlewareOption,
  };
}
