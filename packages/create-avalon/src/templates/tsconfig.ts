export function generateTsConfig(): string {
	const tsconfig = {
		compilerOptions: {
			target: 'ESNext',
			module: 'ESNext',
			moduleResolution: 'bundler',
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			allowArbitraryExtensions: true,
			allowImportingTsExtensions: true,
			noEmit: true,
			jsx: 'react-jsx',
			paths: {
				'@shared/*': ['./app/shared/*'],
				'@modules/*': ['./app/modules/*'],
			},
		},
		include: ['app/**/*.ts', 'app/**/*.tsx', 'app/**/*.d.ts', 'server/**/*.ts', 'routes/**/*.ts', 'middleware/**/*.ts'],
	};

	return JSON.stringify(tsconfig, null, 2);
}

export function generateEnvDts(): string {
	return `/// <reference types="@useavalon/avalon/types" />

// Virtual module declarations
declare module 'virtual:avalon/config' {
  const config: Record<string, unknown>;
  export default config;
}
`;
}
