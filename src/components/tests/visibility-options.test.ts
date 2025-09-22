// Test file to verify the visibility options parsing functionality

// Mock DOM elements for testing
class MockElement {
	private attributes: Map<string, string> = new Map();

	setAttribute(name: string, value: string) {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) || null;
	}
}

// Copy the parsing functions from main.js for testing
function parseVisibilityOptions(condition: string) {
	// Default options
	const defaultOptions = {
		rootMargin: '50px',
		threshold: 0,
	};

	// If it's just 'on:visible' without options, return defaults
	if (condition === 'on:visible') {
		return defaultOptions;
	}

	// Try to parse options from syntax like 'on:visible={{rootMargin: "50px"}}'
	try {
		// Extract the options part after 'on:visible'
		const optionsMatch = condition.match(/on:visible\s*=\s*\{\{(.+?)\}\}/);
		if (!optionsMatch) {
			return defaultOptions;
		}

		const optionsString = optionsMatch[1];

		// Parse the options string as a JavaScript object
		// Handle both quoted and unquoted property names
		const normalizedOptions = optionsString
			.replace(/(\w+):/g, '"$1":') // Add quotes around property names
			.replace(/'/g, '"'); // Convert single quotes to double quotes

		const parsedOptions = JSON.parse(`{${normalizedOptions}}`);

		// Validate and apply parsed options
		const result = { ...defaultOptions };

		if (parsedOptions.rootMargin !== undefined) {
			if (validateRootMargin(parsedOptions.rootMargin)) {
				result.rootMargin = parsedOptions.rootMargin;
			} else {
				console.warn(
					`⚠️ Invalid rootMargin value "${parsedOptions.rootMargin}", using default "${defaultOptions.rootMargin}"`
				);
			}
		}

		if (parsedOptions.threshold !== undefined) {
			if (typeof parsedOptions.threshold === 'number' && parsedOptions.threshold >= 0 && parsedOptions.threshold <= 1) {
				result.threshold = parsedOptions.threshold;
			} else {
				console.warn(
					`⚠️ Invalid threshold value "${parsedOptions.threshold}", using default ${defaultOptions.threshold}`
				);
			}
		}

		return result;
	} catch (error) {
		console.warn(`⚠️ Failed to parse on:visible options from "${condition}", using defaults:`, error);
		return defaultOptions;
	}
}

function validateRootMargin(rootMargin: string): boolean {
	if (typeof rootMargin !== 'string') {
		return false;
	}

	// Valid rootMargin formats:
	// - "10px" (single value)
	// - "10px 20px" (vertical horizontal)
	// - "10px 20px 30px" (top horizontal bottom)
	// - "10px 20px 30px 40px" (top right bottom left)
	// - Can use px, %, or just numbers (treated as px)
	const rootMarginRegex = /^(-?\d+(?:\.\d+)?(?:px|%)?(?:\s+-?\d+(?:\.\d+)?(?:px|%)?){0,3})$/;
	return rootMarginRegex.test(rootMargin.trim());
}

// Test cases
function runTests() {
	console.log('🧪 Testing visibility options parsing...\n');

	// Test 1: Basic on:visible without options
	const test1 = parseVisibilityOptions('on:visible');
	console.log('Test 1 - Basic on:visible:', test1);
	console.assert(test1.rootMargin === '50px', 'Should use default rootMargin');
	console.assert(test1.threshold === 0, 'Should use default threshold');

	// Test 2: on:visible with rootMargin
	const test2 = parseVisibilityOptions('on:visible={{rootMargin: "100px"}}');
	console.log('Test 2 - With rootMargin:', test2);
	console.assert(test2.rootMargin === '100px', 'Should use custom rootMargin');
	console.assert(test2.threshold === 0, 'Should use default threshold');

	// Test 3: on:visible with multiple options
	const test3 = parseVisibilityOptions('on:visible={{rootMargin: "20px", threshold: 0.5}}');
	console.log('Test 3 - Multiple options:', test3);
	console.assert(test3.rootMargin === '20px', 'Should use custom rootMargin');
	console.assert(test3.threshold === 0.5, 'Should use custom threshold');

	// Test 4: on:visible with complex rootMargin
	const test4 = parseVisibilityOptions('on:visible={{rootMargin: "10px 20px 30px 40px"}}');
	console.log('Test 4 - Complex rootMargin:', test4);
	console.assert(test4.rootMargin === '10px 20px 30px 40px', 'Should use complex rootMargin');

	// Test 5: on:visible with percentage rootMargin
	const test5 = parseVisibilityOptions('on:visible={{rootMargin: "10%"}}');
	console.log('Test 5 - Percentage rootMargin:', test5);
	console.assert(test5.rootMargin === '10%', 'Should use percentage rootMargin');

	// Test 6: Invalid rootMargin should fallback
	const test6 = parseVisibilityOptions('on:visible={{rootMargin: "invalid"}}');
	console.log('Test 6 - Invalid rootMargin:', test6);
	console.assert(test6.rootMargin === '50px', 'Should fallback to default for invalid rootMargin');

	// Test 7: Invalid threshold should fallback
	const test7 = parseVisibilityOptions('on:visible={{threshold: 2}}');
	console.log('Test 7 - Invalid threshold:', test7);
	console.assert(test7.threshold === 0, 'Should fallback to default for invalid threshold');

	// Test 8: Malformed options should fallback
	const test8 = parseVisibilityOptions('on:visible={{invalid syntax}}');
	console.log('Test 8 - Malformed options:', test8);
	console.assert(test8.rootMargin === '50px', 'Should fallback to defaults for malformed options');

	console.log('\n✅ All tests completed!');
}

// Test rootMargin validation
function testRootMarginValidation() {
	console.log('\n🧪 Testing rootMargin validation...\n');

	const validCases = [
		'10px',
		'10px 20px',
		'10px 20px 30px',
		'10px 20px 30px 40px',
		'10%',
		'10% 20%',
		'-10px',
		'0px',
		'10',
		'10 20',
		'10.5px',
		'-10.5px 20.3%',
	];

	const invalidCases = [
		'invalid',
		'10px 20px 30px 40px 50px', // too many values
		'10px invalid',
		'',
		'px',
		'10px 20px invalid 40px',
	];

	console.log('Valid cases:');
	validCases.forEach(testCase => {
		const result = validateRootMargin(testCase);
		console.log(`  "${testCase}": ${result}`);
		console.assert(result === true, `Should be valid: ${testCase}`);
	});

	console.log('\nInvalid cases:');
	invalidCases.forEach(testCase => {
		const result = validateRootMargin(testCase);
		console.log(`  "${testCase}": ${result}`);
		console.assert(result === false, `Should be invalid: ${testCase}`);
	});

	console.log('\n✅ RootMargin validation tests completed!');
}

// Run the tests
if (import.meta.main) {
	runTests();
	testRootMarginValidation();
}
