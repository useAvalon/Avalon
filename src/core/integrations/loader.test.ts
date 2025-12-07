import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  detectFrameworkFromPath,
  detectFrameworkFromContent,
  isIntegrationLoaded,
  clearIntegrationCache,
} from "./loader.ts";

Deno.test("Framework Detection from Path", async (t) => {
  await t.step("should detect Vue from .vue extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.vue");
    assertEquals(framework, "vue");
  });

  await t.step("should detect Svelte from .svelte extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.svelte");
    assertEquals(framework, "svelte");
  });

  await t.step("should detect Solid from .solid.tsx extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.solid.tsx");
    assertEquals(framework, "solid");
  });

  await t.step("should detect Solid from .solid.jsx extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.solid.jsx");
    assertEquals(framework, "solid");
  });

  await t.step("should default to Preact for .tsx extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.tsx");
    assertEquals(framework, "preact");
  });

  await t.step("should default to Preact for .jsx extension", () => {
    const framework = detectFrameworkFromPath("/components/Counter.jsx");
    assertEquals(framework, "preact");
  });

  await t.step("should handle paths with multiple dots", () => {
    const framework = detectFrameworkFromPath("/components/Counter.test.solid.tsx");
    assertEquals(framework, "solid");
  });

  await t.step("should handle absolute paths", () => {
    const framework = detectFrameworkFromPath("/absolute/path/to/Component.vue");
    assertEquals(framework, "vue");
  });

  await t.step("should handle relative paths", () => {
    const framework = detectFrameworkFromPath("./components/Component.svelte");
    assertEquals(framework, "svelte");
  });

  await t.step("should handle paths without directory", () => {
    const framework = detectFrameworkFromPath("Component.vue");
    assertEquals(framework, "vue");
  });
});

Deno.test("Framework Detection from Content", async (t) => {
  await t.step("should detect Solid from solid-js import", () => {
    const content = `
      import { createSignal } from "solid-js";
      export default function Counter() {
        const [count, setCount] = createSignal(0);
        return <div>{count()}</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Counter.tsx", content);
    assertEquals(framework, "solid");
  });

  await t.step("should detect Preact from preact import", () => {
    const content = `
      import { h } from "preact";
      import { useState } from "preact/hooks";
      export default function Counter() {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Counter.tsx", content);
    assertEquals(framework, "preact");
  });

  await t.step("should prioritize path detection for Vue files", () => {
    const content = `
      import { ref } from "vue";
      const count = ref(0);
    `;
    const framework = detectFrameworkFromContent("/Counter.vue", content);
    assertEquals(framework, "vue");
  });

  await t.step("should prioritize path detection for Svelte files", () => {
    const content = `
      <script>
        import { onMount } from "svelte";
        let count = 0;
      </script>
    `;
    const framework = detectFrameworkFromContent("/Counter.svelte", content);
    assertEquals(framework, "svelte");
  });

  await t.step("should default to Preact for ambiguous .tsx files", () => {
    const content = `
      export default function Counter() {
        return <div>Hello</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Counter.tsx", content);
    assertEquals(framework, "preact");
  });

  await t.step("should handle content without imports", () => {
    const content = `
      export default function StaticComponent() {
        return <div>Static</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Component.tsx", content);
    assertEquals(framework, "preact");
  });

  await t.step("should use path detection when content is not provided", () => {
    const framework = detectFrameworkFromContent("/Component.vue");
    assertEquals(framework, "vue");
  });

  await t.step("should detect Solid even with Preact-like syntax", () => {
    const content = `
      import { createSignal } from "solid-js";
      import { h } from "preact"; // This shouldn't confuse detection
      export default function Counter() {
        const [count, setCount] = createSignal(0);
        return <div>{count()}</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Counter.tsx", content);
    assertEquals(framework, "solid");
  });
});

Deno.test("Integration Cache Management", async (t) => {
  await t.step("should track loaded integrations", () => {
    clearIntegrationCache();
    
    // Initially nothing is loaded
    assertEquals(isIntegrationLoaded("preact"), false);
    assertEquals(isIntegrationLoaded("vue"), false);
  });

  await t.step("should clear integration cache", () => {
    clearIntegrationCache();
    
    // After clearing, nothing should be loaded
    assertEquals(isIntegrationLoaded("preact"), false);
    assertEquals(isIntegrationLoaded("vue"), false);
    assertEquals(isIntegrationLoaded("solid"), false);
    assertEquals(isIntegrationLoaded("svelte"), false);
  });
});

Deno.test("Framework Detection Edge Cases", async (t) => {
  await t.step("should handle uppercase extensions", () => {
    const framework = detectFrameworkFromPath("/Component.VUE");
    // Should still work (case-sensitive check)
    assertEquals(framework, "preact"); // Falls back to preact
  });

  await t.step("should handle paths with query parameters", () => {
    const framework = detectFrameworkFromPath("/Component.vue?v=123");
    // Query parameters are not stripped, so .vue? doesn't match .vue
    assertEquals(framework, "preact"); // Falls back to default
  });

  await t.step("should handle paths with hash", () => {
    const framework = detectFrameworkFromPath("/Component.svelte#section");
    // Hash is not stripped, so .svelte# doesn't match .svelte
    assertEquals(framework, "preact"); // Falls back to default
  });

  await t.step("should handle empty path", () => {
    const framework = detectFrameworkFromPath("");
    assertEquals(framework, "preact");
  });

  await t.step("should handle path without extension", () => {
    const framework = detectFrameworkFromPath("/Component");
    assertEquals(framework, "preact");
  });

  await t.step("should handle path with only extension", () => {
    const framework = detectFrameworkFromPath(".vue");
    assertEquals(framework, "vue");
  });
});

Deno.test("Content Detection Edge Cases", async (t) => {
  await t.step("should handle empty content", () => {
    const framework = detectFrameworkFromContent("/Component.tsx", "");
    assertEquals(framework, "preact");
  });

  await t.step("should handle content with comments", () => {
    const content = `
      // import { createSignal } from "solid-js";
      /* import { ref } from "vue"; */
      export default function Component() {
        return <div>Hello</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Component.tsx", content);
    // Simple string matching will find "solid-js" even in comments
    assertEquals(framework, "solid");
  });

  await t.step("should handle content with string literals", () => {
    const content = `
      const code = "import { createSignal } from 'solid-js'";
      export default function Component() {
        return <div>{code}</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Component.tsx", content);
    // Simple string matching will find "solid-js" even in strings
    assertEquals(framework, "solid");
  });

  await t.step("should handle multiline imports", () => {
    const content = `
      import {
        createSignal,
        createEffect
      } from "solid-js";
      
      export default function Component() {
        return <div>Hello</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Component.tsx", content);
    assertEquals(framework, "solid");
  });

  await t.step("should handle dynamic imports", () => {
    const content = `
      const loadSolid = () => import("solid-js");
      export default function Component() {
        return <div>Hello</div>;
      }
    `;
    const framework = detectFrameworkFromContent("/Component.tsx", content);
    assertEquals(framework, "solid");
  });
});

Deno.test("Framework Detection Consistency", async (t) => {
  await t.step("should be consistent for same input", () => {
    const path = "/Component.vue";
    const framework1 = detectFrameworkFromPath(path);
    const framework2 = detectFrameworkFromPath(path);
    assertEquals(framework1, framework2);
  });

  await t.step("should be consistent with content detection", () => {
    const path = "/Component.solid.tsx";
    const content = 'import { createSignal } from "solid-js";';
    
    const fromPath = detectFrameworkFromPath(path);
    const fromContent = detectFrameworkFromContent(path, content);
    
    assertEquals(fromPath, "solid");
    assertEquals(fromContent, "solid");
  });

  await t.step("should handle all supported frameworks", () => {
    const frameworks = [
      { path: "/Component.vue", expected: "vue" },
      { path: "/Component.svelte", expected: "svelte" },
      { path: "/Component.solid.tsx", expected: "solid" },
      { path: "/Component.tsx", expected: "preact" },
      { path: "/Component.jsx", expected: "preact" },
    ];
    
    frameworks.forEach(({ path, expected }) => {
      const detected = detectFrameworkFromPath(path);
      assertEquals(detected, expected, `Failed for ${path}`);
    });
  });
});
