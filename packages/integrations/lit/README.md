# @useavalon/lit

Lit integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for Lit web components as islands.

## Features

- Lit 3 with decorators and Shadow DOM
- Server-side rendering via `@lit-labs/ssr`
- Declarative shadow DOM for SSR
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```ts
// components/MyButton.lit.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-button')
export class MyButton extends LitElement {
  @property() label = 'Click me';

  static styles = css`
    button { background: #324FFF; color: white; padding: 8px 16px; border: none; border-radius: 4px; }
  `;

  render() {
    return html`<button>${this.label}</button>`;
  }
}
```

```tsx
// pages/index.tsx
import MyButton from '../components/MyButton.lit.ts';

export default function Home() {
  return <MyButton island={{ condition: 'on:visible' }} label="Click me" />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/lit)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
