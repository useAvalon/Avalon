import { LitElement, html, css } from "lit";

export class WebCounter extends LitElement {
  // Static element name for SSR tag name extraction
  static elementName = "web-counter";

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }

    .counter {
      text-align: center;
      padding: 20px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
      color: white;
      border-radius: 10px;
    }

    h4 {
      margin: 0 0 15px 0;
    }

    .count {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 15px;
      background: rgba(255, 255, 255, 0.2);
      padding: 10px;
      border-radius: 8px;
    }

    .controls {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 10px;
    }

    button {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      font-size: 1.2rem;
      transition: background 0.2s;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .reset {
      font-size: 0.9rem;
      padding: 6px 12px;
    }

    .label {
      margin-top: 10px;
      font-size: 0.9rem;
      opacity: 0.8;
    }
  `;

  // Define properties without decorators
  static properties = {
    initialCount: { type: Number, attribute: 'initial-count' },
    count: { type: Number, state: true },
  };

  initialCount = 0;
  private count = 0;

  connectedCallback() {
    super.connectedCallback();
    this.count = this.initialCount;
  }

  private increment() {
    this.count++;
  }

  private decrement() {
    this.count--;
  }

  private reset() {
    this.count = 0;
  }

  render() {
    return html`
      <div class="counter">
        <h4>🔥 Lit Counter</h4>
        <div class="count">${this.count}</div>
        <div class="controls">
          <button @click=${this.decrement}>−</button>
          <button @click=${this.increment}>+</button>
        </div>
        <button class="reset" @click=${this.reset}>Reset</button>
        <p class="label">Powered by Lit Web Components</p>
      </div>
    `;
  }
}

// Register custom element without decorator
if (typeof customElements !== 'undefined' && !customElements.get("web-counter")) {
  customElements.define("web-counter", WebCounter);
}

declare global {
  interface HTMLElementTagNameMap {
    "web-counter": WebCounter;
  }
}
