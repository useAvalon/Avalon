import { LitElement, html, css } from "lit";

export class EventWebCounter extends LitElement {
  static elementName = "event-web-counter";

  static styles = css`
    :host { display: block; font-family: system-ui, sans-serif; }
    .counter {
      text-align: center; padding: 20px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
      color: white; border-radius: 10px;
    }
    h4 { margin: 0 0 15px 0; }
    .count {
      font-size: 2rem; font-weight: bold; margin-bottom: 15px;
      background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;
    }
    .controls { display: flex; gap: 10px; justify-content: center; }
    button {
      padding: 8px 16px; background: rgba(255,255,255,0.2); border: none;
      border-radius: 6px; color: white; cursor: pointer; font-size: 1.2rem;
    }
    button:hover { background: rgba(255,255,255,0.3); }
    .label { margin-top: 10px; font-size: 0.8rem; opacity: 0.7; }
  `;

  static properties = {
    initialCount: { type: Number, attribute: 'initial-count' },
    count: { type: Number, state: true },
  };

  initialCount = 0;
  private count = -1;
  private _handler: ((e: Event) => void) | null = null;

  willUpdate(changedProperties: Map<string, unknown>) {
    if (this.count === -1 || changedProperties.has('initialCount')) {
      this.count = this.initialCount;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._handler = (e: Event) => {
      this.count = (e as CustomEvent).detail.count;
    };
    document.addEventListener('counter:update', this._handler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._handler) {
      document.removeEventListener('counter:update', this._handler);
    }
  }

  private dispatch(next: number) {
    this.count = next;
    document.dispatchEvent(new CustomEvent('counter:update', { detail: { count: next } }));
  }

  render() {
    return html`
      <div class="counter">
        <h4>🔥 Lit</h4>
        <div class="count">${this.count}</div>
        <div class="controls">
          <button @click=${() => this.dispatch(this.count - 1)}>−</button>
          <button @click=${() => this.dispatch(this.count + 1)}>+</button>
        </div>
        <p class="label">via CustomEvent</p>
      </div>
    `;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get("event-web-counter")) {
  customElements.define("event-web-counter", EventWebCounter);
}
