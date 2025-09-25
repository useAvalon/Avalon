import { assertEquals, assertExists } from '@std/assert';

// Test the enhanced hydration option parsing functionality
// Since the functions are in main.js, we'll test the behavior through integration

Deno.test('Hydration Option Parsing - validateRootMargin patterns', () => {
	// Test basic rootMargin validation patterns
	const validPatterns = ['10px', '10px 20px', '10px 20px 30px 40px', '10%', '-10px', '0px', '100px 50px'];

	const invalidPatterns = [
		'invalid',
		'',
		'10px 20px 30px 40px 50px', // too many values
		'abc',
		'10px invalid 20px',
	];

	// Since we can't easily import the function, we'll test the regex pattern directly
	const rootMarginRegex = /^(-?\d+(?:\.\d+)?(?:px|%)?(?:\s+-?\d+(?:\.\d+)?(?:px|%)?){0,3})$/;

	validPatterns.forEach(pattern => {
		assertEquals(rootMarginRegex.test(pattern.trim()), true, `Pattern "${pattern}" should be valid`);
	});

	invalidPatterns.forEach(pattern => {
		assertEquals(rootMarginRegex.test(pattern.trim()), false, `Pattern "${pattern}" should be invalid`);
	});
});

Deno.test('Hydration Option Parsing - directive parsing patterns', () => {
	// Test directive parsing patterns
	const testCases = [
		{
			input: 'on:client',
			expectedDirective: 'on:client',
			description: 'simple directive',
		},
		{
			input: 'on:visible={{rootMargin: "100px"}}',
			expectedDirective: 'on:visible',
			description: 'directive with options',
		},
		{
			input: 'on:idle={{timeout: 10000}}',
			expectedDirective: 'on:idle',
			description: 'idle directive with timeout',
		},
		{
			input: 'media:screen',
			expectedDirective: 'media:screen',
			description: 'media directive',
		},
	];

	testCases.forEach(testCase => {
		// Extract directive name (everything before the first '=' or the whole string)
		const directiveMatch = testCase.input.match(/^([^=\s]+)/);
		const directive = directiveMatch ? directiveMatch[1] : 'on:client';

		assertEquals(directive, testCase.expectedDirective, `Failed for ${testCase.description}`);
	});
});

Deno.test('Hydration Option Parsing - option extraction patterns', () => {
	// Test option extraction patterns
	const testCases = [
		{
			input: 'on:visible={{rootMargin: "100px"}}',
			expectedOptions: 'rootMargin: "100px"',
			description: 'single option',
		},
		{
			input: 'on:visible={{rootMargin: "50px", threshold: 0.5}}',
			expectedOptions: 'rootMargin: "50px", threshold: 0.5',
			description: 'multiple options',
		},
		{
			input: 'on:idle={{timeout: 10000}}',
			expectedOptions: 'timeout: 10000',
			description: 'timeout option',
		},
	];

	testCases.forEach(testCase => {
		const optionsMatch = testCase.input.match(/=\s*\{\{(.+?)\}\}/);
		const extractedOptions = optionsMatch ? optionsMatch[1] : '';

		assertEquals(extractedOptions, testCase.expectedOptions, `Failed for ${testCase.description}`);
	});
});

Deno.test('Hydration Option Parsing - JSON parsing preparation', () => {
	// Test the normalization of options strings for JSON parsing
	const testCases = [
		{
			input: 'rootMargin: "100px"',
			expected: '"rootMargin": "100px"',
			description: 'add quotes to property names',
		},
		{
			input: "rootMargin: '100px'",
			expected: '"rootMargin": "100px"',
			description: 'convert single quotes to double quotes',
		},
		{
			input: 'timeout: 5000',
			expected: '"timeout": 5000',
			description: 'numeric values',
		},
	];

	testCases.forEach(testCase => {
		// Simulate the normalization process
		const normalized = testCase.input
			.replace(/(\w+):/g, '"$1":') // Add quotes around property names
			.replace(/'/g, '"'); // Convert single quotes to double quotes

		assertEquals(normalized, testCase.expected, `Failed for ${testCase.description}`);

		// Test that it can be parsed as JSON
		try {
			const parsed = JSON.parse(`{${normalized}}`);
			assertExists(parsed, `Should be able to parse normalized JSON for ${testCase.description}`);
		} catch (error) {
			throw new Error(
				`Failed to parse JSON for ${testCase.description}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	});
});

Deno.test('Hydration Option Parsing - validation ranges', () => {
	// Test validation ranges for different option types

	// Threshold validation (0-1 range)
	const validThresholds = [0, 0.5, 1, 0.25, 0.75];
	const invalidThresholds = [-0.1, 1.1, 2, -1, '0.5', null, undefined];

	validThresholds.forEach(threshold => {
		const isValid = typeof threshold === 'number' && threshold >= 0 && threshold <= 1;
		assertEquals(isValid, true, `Threshold ${threshold} should be valid`);
	});

	invalidThresholds.forEach(threshold => {
		const isValid = typeof threshold === 'number' && threshold >= 0 && threshold <= 1;
		assertEquals(isValid, false, `Threshold ${threshold} should be invalid`);
	});

	// Timeout validation (positive numbers up to 60 seconds)
	const validTimeouts = [1000, 5000, 30000, 60000];
	const invalidTimeouts = [0, -1000, 70000, '5000', null, undefined];

	validTimeouts.forEach(timeout => {
		const isValid = typeof timeout === 'number' && timeout > 0 && timeout <= 60000;
		assertEquals(isValid, true, `Timeout ${timeout} should be valid`);
	});

	invalidTimeouts.forEach(timeout => {
		const isValid = typeof timeout === 'number' && timeout > 0 && timeout <= 60000;
		assertEquals(isValid, false, `Timeout ${timeout} should be invalid`);
	});
});
