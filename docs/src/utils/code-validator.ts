import { CodeExample } from './markdown-processor.ts';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface ValidationOptions {
	checkSyntax: boolean;
	checkImports: boolean;
	checkTypes: boolean;
	framework?: string;
}

/**
 * Validate TypeScript/JavaScript code examples
 */
export async function validateCode(
	code: string,
	language: string,
	options: ValidationOptions = { checkSyntax: true, checkImports: false, checkTypes: false }
): Promise<ValidationResult> {
	const result: ValidationResult = {
		valid: true,
		errors: [],
		warnings: [],
	};

	try {
		// Basic syntax validation
		if (options.checkSyntax) {
			const syntaxErrors = await checkSyntax(code, language);
			result.errors.push(...syntaxErrors);
		}

		// Import validation
		if (options.checkImports) {
			const importErrors = await checkImports(code);
			result.errors.push(...importErrors);
		}

		// Type checking for TypeScript
		if (options.checkTypes && (language === 'typescript' || language === 'tsx')) {
			const typeErrors = await checkTypes(code);
			result.errors.push(...typeErrors);
		}

		// Framework-specific validation
		if (options.framework) {
			const frameworkErrors = await validateFrameworkCode(code, options.framework);
			result.errors.push(...frameworkErrors);
		}

		result.valid = result.errors.length === 0;
	} catch (error) {
		result.valid = false;
		result.errors.push(`Validation error: ${error.message}`);
	}

	return result;
}

/**
 * Check basic syntax errors
 */
async function checkSyntax(code: string, language: string): Promise<string[]> {
	const errors: string[] = [];

	try {
		if (language === 'javascript' || language === 'jsx') {
			// Basic JavaScript syntax check
			new Function(code);
		} else if (language === 'typescript' || language === 'tsx') {
			// For TypeScript, we'd need to use the TypeScript compiler API
			// For now, just check for obvious syntax issues
			if (code.includes('SyntaxError')) {
				errors.push('Syntax error detected in code');
			}
		}
	} catch (error) {
		errors.push(`Syntax error: ${error.message}`);
	}

	return errors;
}

/**
 * Check import statements
 */
async function checkImports(code: string): Promise<string[]> {
	const errors: string[] = [];
	const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

	let match;
	while ((match = importRegex.exec(code)) !== null) {
		const importPath = match[1];

		// Check for common import issues
		if (importPath.startsWith('./') || importPath.startsWith('../')) {
			// Relative imports - would need file system check
			continue;
		}

		// Check for known Avalon imports
		const validAvalonImports = ['@avalon/framework', 'preact', 'vue', 'svelte', 'solid-js'];

		if (!validAvalonImports.some(valid => importPath.startsWith(valid))) {
			errors.push(`Unknown import: ${importPath}`);
		}
	}

	return errors;
}

/**
 * Check TypeScript types
 */
async function checkTypes(code: string): Promise<string[]> {
	const errors: string[] = [];

	// Basic type checking - in a full implementation, this would use the TypeScript compiler API
	if (code.includes(': any')) {
		errors.push('Avoid using "any" type - use specific types instead');
	}

	return errors;
}

/**
 * Validate framework-specific code
 */
async function validateFrameworkCode(code: string, framework: string): Promise<string[]> {
	const errors: string[] = [];

	switch (framework) {
		case 'preact':
			if (!code.includes('import') && code.includes('jsx')) {
				errors.push('Preact components should import necessary dependencies');
			}
			break;

		case 'vue':
			if (code.includes('<template>') && !code.includes('<script>')) {
				errors.push('Vue components with templates should have script sections');
			}
			break;

		case 'svelte':
			if (code.includes('<script>') && !code.includes('export')) {
				errors.push('Svelte components should export props or have component logic');
			}
			break;

		case 'solid':
			if (code.includes('createSignal') && !code.includes('import')) {
				errors.push('Solid components should import createSignal from solid-js');
			}
			break;
	}

	return errors;
}

/**
 * Validate all code examples in a markdown file
 */
export async function validateAllExamples(examples: CodeExample[]): Promise<Map<string, ValidationResult>> {
	const results = new Map<string, ValidationResult>();

	for (const example of examples) {
		const result = await validateCode(example.code, example.language, {
			checkSyntax: true,
			checkImports: true,
			checkTypes: example.language.includes('typescript'),
			framework: example.framework,
		});

		results.set(example.id, result);
	}

	return results;
}

/**
 * Generate validation report
 */
export function generateValidationReport(results: Map<string, ValidationResult>): string {
	let report = '# Code Validation Report\n\n';
	let totalExamples = 0;
	let validExamples = 0;

	for (const [exampleId, result] of results) {
		totalExamples++;
		if (result.valid) {
			validExamples++;
		}

		report += `## ${exampleId}\n`;
		report += `Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}\n\n`;

		if (result.errors.length > 0) {
			report += '### Errors\n';
			for (const error of result.errors) {
				report += `- ${error}\n`;
			}
			report += '\n';
		}

		if (result.warnings.length > 0) {
			report += '### Warnings\n';
			for (const warning of result.warnings) {
				report += `- ${warning}\n`;
			}
			report += '\n';
		}
	}

	report += `## Summary\n`;
	report += `Valid examples: ${validExamples}/${totalExamples}\n`;
	report += `Success rate: ${((validExamples / totalExamples) * 100).toFixed(1)}%\n`;

	return report;
}
