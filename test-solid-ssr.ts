#!/usr/bin/env -S deno run --allow-all
/**
 * Test SolidJS SSR with Vite plugin enabled
 */

console.log('🔍 Testing SolidJS SSR with Vite plugin...\n');

const originalCwd = Deno.cwd();

try {
	Deno.chdir('./Avalon');

	console.log('📋 Test: SolidJS component SSR rendering');

	const { renderIsland } = await import('./src/islands/island.tsx');

	const result = await renderIsland({
		src: '/islands/SolidCounter.tsx',
		ssr: true,
		condition: 'on:client',
		props: { initialCount: 10 },
		renderOptions: {},
	});

	console.log('✅ SolidJS component rendered');

	// Check the result
	const resultStr = JSON.stringify(result);
	const hasSSRContent = resultStr.includes('dangerouslySetInnerHTML') || resultStr.includes('children');
	const hasSolidAttributes = resultStr.includes('data-solid-hydrate');
	const hasHydrateStrategy = resultStr.includes('hydrate');

	console.log('\n📊 SSR Analysis:');
	console.log(`  • Has SSR content: ${hasSSRContent}`);
	console.log(`  • Has Solid attributes: ${hasSolidAttributes}`);
	console.log(`  • Has hydrate strategy: ${hasHydrateStrategy}`);

	if (hasSSRContent && hasSolidAttributes) {
		console.log('✅ SolidJS SSR is working correctly!');
	} else {
		console.log('❌ SolidJS SSR is not working properly');
		console.log('\n📄 Result preview:');
		console.log(resultStr.substring(0, 500) + '...');
	}
} catch (error) {
	console.error('❌ Test failed:', error.message);
	console.error(error.stack);
} finally {
	Deno.chdir(originalCwd);
}

console.log('\n🎯 SolidJS SSR test complete');
