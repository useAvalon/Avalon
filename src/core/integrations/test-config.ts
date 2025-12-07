/**
 * Simple test script to verify the integration configuration system
 */

import { initializeIntegrations, formatInitializationResult } from "./startup.ts";

async function testConfigSystem() {
  console.log("Testing Integration Configuration System\n");
  console.log("=".repeat(50));
  
  try {
    const result = await initializeIntegrations();
    console.log(formatInitializationResult(result));
    
    if (result.success) {
      console.log("\n✓ Configuration system is working correctly!");
      Deno.exit(0);
    } else {
      console.log("\n✗ Configuration system has errors");
      Deno.exit(1);
    }
  } catch (error) {
    console.error("\n✗ Fatal error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await testConfigSystem();
}
