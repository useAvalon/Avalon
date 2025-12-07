import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import Island from "../src/islands/island.tsx";

Deno.test("Island component - data attributes", async (t) => {
  await t.step("should render with data-src attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-src="/islands/Counter.tsx"');
  });

  await t.step("should render with data-condition attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:visible",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="on:visible"');
  });

  await t.step("should render with data-framework attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      framework: "preact",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-framework="preact"');
  });

  await t.step("should render with data-props attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 42, name: "test" },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-props=');
    // Props are JSON stringified and HTML-escaped
    assertStringIncludes(html, '&quot;count&quot;:42');
    assertStringIncludes(html, '&quot;name&quot;:&quot;test&quot;');
  });

  await t.step("should render with data-render-strategy='hydrate' for interactive islands", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-render-strategy="hydrate"');
  });

  await t.step("should render with data-render-strategy='ssr-only' for SSR-only islands", () => {
    const island = Island({
      src: "/islands/Static.tsx",
      props: {},
      ssrOnly: true,
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-render-strategy="ssr-only"');
  });

  await t.step("should NOT include data-hydrate attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertEquals(html.includes('data-hydrate='), false, "Should not include data-hydrate attribute");
  });

  await t.step("should detect framework from .vue extension", () => {
    const island = Island({
      src: "/islands/Counter.vue",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-framework="vue"');
  });

  await t.step("should detect framework from .svelte extension", () => {
    const island = Island({
      src: "/islands/Counter.svelte",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-framework="svelte"');
  });

  await t.step("should detect framework from .solid. in filename", () => {
    const island = Island({
      src: "/islands/Counter.solid.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-framework="solid"');
  });

  await t.step("should default to preact for .tsx files", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-framework="preact"');
  });
});

Deno.test("Island component - hydration conditions", async (t) => {
  await t.step("should support on:client condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="on:client"');
  });

  await t.step("should support on:visible condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:visible",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="on:visible"');
  });

  await t.step("should support on:interaction condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:interaction",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="on:interaction"');
  });

  await t.step("should support on:idle condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:idle",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="on:idle"');
  });

  await t.step("should support media: condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "media:(min-width: 768px)",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-condition="media:(min-width: 768px)"');
  });
});

Deno.test("Island component - SSR with children", async (t) => {
  await t.step("should render children with hydration attributes", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: { count: 0 },
      children: "<div>SSR Content</div>",
      ssr: true,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-src="/islands/Counter.tsx"');
    assertStringIncludes(html, 'data-condition="on:client"');
    assertStringIncludes(html, 'data-framework="preact"');
    assertStringIncludes(html, "<div>SSR Content</div>");
  });

  await t.step("should render SSR-only children without hydration attributes", () => {
    const island = Island({
      src: "/islands/Static.tsx",
      props: {},
      children: "<div>Static Content</div>",
      ssr: true,
      ssrOnly: true,
    });

    const html = renderToString(island);
    assertStringIncludes(html, 'data-render-strategy="ssr-only"');
    assertStringIncludes(html, "<div>Static Content</div>");
    assertEquals(html.includes('data-src='), false, "Should not include data-src for SSR-only");
    assertEquals(html.includes('data-condition='), false, "Should not include data-condition for SSR-only");
  });
});

Deno.test("Island component - ID generation", async (t) => {
  await t.step("should generate deterministic ID from src path", () => {
    const island1 = Island({
      src: "/islands/Counter.tsx",
      props: {},
      ssr: false,
    });

    const island2 = Island({
      src: "/islands/Counter.tsx",
      props: {},
      ssr: false,
    });

    const html1 = renderToString(island1);
    const html2 = renderToString(island2);

    // Both should have the same ID
    assertStringIncludes(html1, 'id="island--islands-Counter-tsx"');
    assertStringIncludes(html2, 'id="island--islands-Counter-tsx"');
  });

  await t.step("should generate different IDs for different components", () => {
    const island1 = Island({
      src: "/islands/Counter.tsx",
      props: {},
      ssr: false,
    });

    const island2 = Island({
      src: "/islands/Button.tsx",
      props: {},
      ssr: false,
    });

    const html1 = renderToString(island1);
    const html2 = renderToString(island2);

    assertStringIncludes(html1, 'id="island--islands-Counter-tsx"');
    assertStringIncludes(html2, 'id="island--islands-Button-tsx"');
  });
});
