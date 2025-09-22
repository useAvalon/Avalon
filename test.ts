#!/usr/bin/env deno run --no-check --allow-env --allow-read --allow-write

/**
 * Test runner for the entire project
 * Runs tests in the new co-located structure
 */

const testDirectories = [
	'src/core/layout/tests/',
	'src/core/middleware/tests/',
	'src/components/tests/',
	'src/types/tests/',
	'src/client/tests/',
	'src/core/tests/',
];

const runTests = async () => {
	console.log('🧪 Running all tests in co-located structure...');
	console.log('='.repeat(50));

	let totalPassed = 0;
	let totalFailed = 0;
	let totalIgnored = 0;

	for (const dir of testDirectories) {
		console.log(`\n📁 Testing: ${dir}`);
		try {
			const cmd = new Deno.Command('deno', {
				args: ['test', dir, '--no-check', '--allow-env', '--allow-read', '--allow-write', '--quiet'],
				stdout: 'piped',
				stderr: 'piped',
			});

			const { code, stdout, stderr } = await cmd.output();

			if (code === 0) {
				console.log('✅ PASSED');
				const output = new TextDecoder().decode(stdout);
				const summary = output.split('\n').pop()?.trim();
				if (summary) {
					console.log(`   ${summary}`);
					// Extract numbers from summary
					const passedMatch = summary.match(/(\d+) passed/);
					const ignoredMatch = summary.match(/(\d+) ignored/);
					if (passedMatch) totalPassed += parseInt(passedMatch[1]);
					if (ignoredMatch) totalIgnored += parseInt(ignoredMatch[1]);
				}
			} else {
				console.log('❌ FAILED');
				const errorOutput = new TextDecoder().decode(stderr);
				const output = new TextDecoder().decode(stdout);

				// Try to extract test counts from output
				const passedMatch = output.match(/(\d+) passed/);
				const failedMatch = output.match(/(\d+) failed/);
				const ignoredMatch = output.match(/(\d+) ignored/);

				if (passedMatch) totalPassed += parseInt(passedMatch[1]);
				if (failedMatch) totalFailed += parseInt(failedMatch[1]);
				if (ignoredMatch) totalIgnored += parseInt(ignoredMatch[1]);

				// Show brief error summary
				const lines = errorOutput.split('\n');
				const failureLines = lines
					.filter(line => line.includes('FAILED') || line.includes('error:') || line.includes('AssertionError'))
					.slice(0, 3);

				if (failureLines.length > 0) {
					console.log('   Errors:');
					failureLines.forEach(line => console.log(`     ${line.trim()}`));
				}
			}
		} catch (error) {
			console.log(`⚠️  Error running tests in ${dir}:`, error.message);
		}
	}

	console.log('\n' + '='.repeat(50));
	console.log('🎉 Test run complete!');
	console.log(`📊 Summary: ${totalPassed} passed, ${totalFailed} failed, ${totalIgnored} ignored`);

	if (totalFailed > 0) {
		console.log('\n⚠️  Some tests failed. Run individual test directories for details.');
		Deno.exit(1);
	}
};

if (import.meta.main) {
	await runTests();
}
