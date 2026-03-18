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
			jsx: 'react-jsx',
			paths: {
				'@shared/*': ['./app/shared/*'],
				'@modules/*': ['./app/modules/*'],
			},
		},
		include: ['app/**/*.ts', 'app/**/*.tsx', 'server/**/*.ts', 'routes/**/*.ts', 'middleware/**/*.ts'],
	};

	return JSON.stringify(tsconfig, null, 2);
}
