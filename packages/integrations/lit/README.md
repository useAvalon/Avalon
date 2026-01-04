# Lit Integration for Avalon

Server-side rendering and client-side hydration for [Lit](https://lit.dev/) web components.

## Features

- Server-side rendering using `@lit-labs/ssr`
- Automatic client-side hydration with `@lit-labs/ssr-client`
- Shadow DOM with declarative shadow DOM for SSR
- Scoped styles
- TypeScript decorators support

## Usage

Create a Lit component:

```typescript
// src/islands/MyButton.lit.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-button')
export class MyButton extends LitElement {
  @property({ type: String, attribute: 'label' })
  label = 'Click me';

  static styles = css`
    button {
      background: blue;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
    }
  `;

  render() {
    return html`<button @click=${this._handleClick}>${this.label}</button>`;
  }

  private _handleClick() {
    this.dispatchEvent(new CustomEvent('click'));
  }
}
```

Use it in a page:

```tsx
import { Island } from '@avalon/core';

export default function Home() {
  return (
    <Island 
      framework="lit" 
      src="/islands/MyButton.lit.ts"
      props={{ label: "Click me!" }}
    />
  );
}
```

## How SSR/Hydration Works

1. Server renders component with declarative shadow DOM and `defer-hydration` attribute
2. Client loads `@lit-labs/ssr-client/lit-element-hydrate-support.js` before components
3. When component is defined, Lit recognizes the existing shadow DOM and hydrates it
4. `defer-hydration` attribute is removed to trigger hydration

## API

```typescript
interface LitRenderParams {
  src: string;
  props: Record<string, unknown>;
  tagName?: string;  // Optional: extracted from @customElement decorator
  ssrOnly?: boolean;
  condition?: "on:client" | "on:visible" | "on:idle" | "on:interaction";
}
```

## Best Practices

- Use `@property({ attribute: 'name' })` to ensure SSR props sync correctly
- Keep tag names in `@customElement()` as string literals for SSR extraction
- Use Shadow DOM (default) for style encapsulation

## Resources

- [Lit Documentation](https://lit.dev/)
- [Lit SSR](https://lit.dev/docs/ssr/overview/)
