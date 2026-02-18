import { describe, it, expect } from 'vitest';
import { renderToString } from "preact-render-to-string";
import Island from "../packages/avalon/src/islands/island.tsx";

describe("Island component - data attributes", () => {
  it("should render with data-src attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    // Path is resolved to /src/islands/Counter.tsx by the nested islands support
    expect(html).toContain('data-src="/src/islands/Counter.tsx"');
  });

  it("should render with data-condition attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:visible",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="on:visible"');
  });

  it("should render with data-framework attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      framework: "preact",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-framework="preact"');
  });

  it("should render with data-props attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 42, name: "test" },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-props=');
    // Props are JSON stringified and HTML-escaped
    expect(html).toContain('&quot;count&quot;:42');
    expect(html).toContain('&quot;name&quot;:&quot;test&quot;');
  });

  it("should render with data-render-strategy='hydrate' for interactive islands", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-render-strategy="hydrate"');
  });

  it("should render with data-render-strategy='ssr-only' for SSR-only islands", () => {
    const island = Island({
      src: "/islands/Static.tsx",
      props: {},
      ssrOnly: true,
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-render-strategy="ssr-only"');
  });

  it("should NOT include data-hydrate attribute", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html.includes('data-hydrate=')).toEqual(false);
  });

  it("should detect framework from .vue extension", () => {
    const island = Island({
      src: "/islands/Counter.vue",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-framework="vue"');
  });

  it("should detect framework from .svelte extension", () => {
    const island = Island({
      src: "/islands/Counter.svelte",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-framework="svelte"');
  });

  it("should detect framework from .solid. in filename", () => {
    const island = Island({
      src: "/islands/Counter.solid.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-framework="solid"');
  });

  it("should default to preact for .tsx files", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      props: { count: 0 },
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-framework="preact"');
  });
});

describe("Island component - hydration conditions", () => {
  it("should support on:client condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="on:client"');
  });

  it("should support on:visible condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:visible",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="on:visible"');
  });

  it("should support on:interaction condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:interaction",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="on:interaction"');
  });

  it("should support on:idle condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:idle",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="on:idle"');
  });

  it("should support media: condition", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "media:(min-width: 768px)",
      props: {},
      ssr: false,
    });

    const html = renderToString(island);
    expect(html).toContain('data-condition="media:(min-width: 768px)"');
  });
});

describe("Island component - SSR with children", () => {
  it("should render children with hydration attributes", () => {
    const island = Island({
      src: "/islands/Counter.tsx",
      condition: "on:client",
      props: { count: 0 },
      children: "<div>SSR Content</div>",
      ssr: true,
    });

    const html = renderToString(island);
    // Path is resolved to /src/islands/Counter.tsx by the nested islands support
    expect(html).toContain('data-src="/src/islands/Counter.tsx"');
    expect(html).toContain('data-condition="on:client"');
    expect(html).toContain('data-framework="preact"');
    expect(html).toContain("<div>SSR Content</div>");
  });

  it("should render SSR-only children without hydration attributes", () => {
    const island = Island({
      src: "/islands/Static.tsx",
      props: {},
      children: "<div>Static Content</div>",
      ssr: true,
      ssrOnly: true,
    });

    const html = renderToString(island);
    expect(html).toContain('data-render-strategy="ssr-only"');
    expect(html).toContain("<div>Static Content</div>");
    expect(html.includes('data-src=')).toEqual(false);
    expect(html.includes('data-condition=')).toEqual(false);
  });
});

describe("Island component - ID generation", () => {
  it("should generate deterministic ID from src path", () => {
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
    expect(html1).toContain('id="island--islands-Counter-tsx"');
    expect(html2).toContain('id="island--islands-Counter-tsx"');
  });

  it("should generate different IDs for different components", () => {
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

    expect(html1).toContain('id="island--islands-Counter-tsx"');
    expect(html2).toContain('id="island--islands-Button-tsx"');
  });
});
