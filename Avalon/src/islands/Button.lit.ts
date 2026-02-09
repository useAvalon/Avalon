import { LitElement, html, css } from "lit";

export class LitButton extends LitElement {
  // Static element name for SSR tag name extraction
  static elementName = "lit-button";

  static styles = css`
    :host {
      display: inline-block;
    }

    .button-container {
      padding: 20px;
      border: 2px solid #ff6b6b;
      border-radius: 8px;
      background-color: #fff5f5;
      font-family: system-ui, sans-serif;
    }

    h2 {
      margin: 0 0 16px 0;
      color: #c92a2a;
    }

    .custom-button {
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      background-color: #ff6b6b;
      color: white;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .custom-button:hover {
      background-color: #fa5252;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .custom-button:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .click-count {
      margin-top: 16px;
      padding: 12px;
      background-color: rgba(255, 107, 107, 0.1);
      border-radius: 4px;
      font-size: 14px;
      color: #666;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      background-color: #ff6b6b;
      color: white;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 8px;
    }

    .info {
      margin-top: 12px;
      font-size: 12px;
      color: #999;
      font-style: italic;
    }
  `;

  // Define properties without decorators
  static properties = {
    label: { type: String, attribute: 'label' },
    variant: { type: String, attribute: 'variant' },
    clickCount: { type: Number, state: true },
    lastClickTime: { type: String, state: true },
  };

  label = "Click Me";
  variant = "primary";
  private clickCount = 0;
  private lastClickTime = "";

  private handleClick() {
    this.clickCount++;
    this.lastClickTime = new Date().toLocaleTimeString();
    
    // Dispatch custom event for cross-component communication
    this.dispatchEvent(
      new CustomEvent("button-clicked", {
        detail: { count: this.clickCount, time: this.lastClickTime },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="button-container">
        <h2>Lit Button with Shadow DOM</h2>
        <button class="custom-button" @click=${this.handleClick}>
          ${this.label}
          ${this.clickCount > 0 ? html`<span class="badge">${this.clickCount}</span>` : ""}
        </button>
        
        ${this.clickCount > 0
          ? html`
              <div class="click-count">
                <strong>Clicked ${this.clickCount} time${this.clickCount !== 1 ? "s" : ""}</strong>
                ${this.lastClickTime ? html`<br />Last click: ${this.lastClickTime}` : ""}
              </div>
            `
          : ""}
        
        <div class="info">
          This button uses Shadow DOM for style encapsulation.
          Styles are scoped and won't leak to other components.
        </div>
      </div>
    `;
  }
}

// Register custom element without decorator
if (typeof customElements !== 'undefined' && !customElements.get("lit-button")) {
  customElements.define("lit-button", LitButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "lit-button": LitButton;
  }
}
