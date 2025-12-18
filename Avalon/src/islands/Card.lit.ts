import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("lit-card")
export class LitCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 400px;
    }

    .card {
      padding: 20px;
      border: 2px solid #ff6b6b;
      border-radius: 8px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
      font-family: system-ui, sans-serif;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .card:hover {
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #ff6b6b;
    }

    h2 {
      margin: 0;
      color: #c92a2a;
      font-size: 20px;
    }

    .badge {
      padding: 4px 12px;
      background-color: #ff6b6b;
      color: white;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }

    .card-content {
      margin-bottom: 16px;
      color: #333;
      line-height: 1.6;
    }

    .card-footer {
      display: flex;
      gap: 8px;
    }

    button {
      flex: 1;
      padding: 10px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      transition: all 0.2s;
    }

    .primary {
      background-color: #ff6b6b;
      color: white;
    }

    .primary:hover {
      background-color: #fa5252;
    }

    .secondary {
      background-color: white;
      color: #ff6b6b;
      border: 2px solid #ff6b6b;
    }

    .secondary:hover {
      background-color: #fff5f5;
    }

    .stats {
      margin-top: 16px;
      padding: 12px;
      background-color: rgba(255, 107, 107, 0.1);
      border-radius: 4px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #c92a2a;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .info {
      margin-top: 12px;
      padding: 8px;
      background-color: rgba(255, 107, 107, 0.05);
      border-left: 3px solid #ff6b6b;
      font-size: 12px;
      color: #666;
    }
  `;

  @property({ type: String, attribute: 'title' })
  title = "Lit Card Component";

  @property({ type: String, attribute: 'description' })
  description = "This card demonstrates Lit's scoped styles and reactive properties.";

  @property({ type: String, attribute: 'badge' })
  badge = "Featured";

  @state()
  private likes = 0;

  @state()
  private views = 0;

  connectedCallback() {
    super.connectedCallback();
    // Simulate initial views
    this.views = Math.floor(Math.random() * 100) + 1;
  }

  private handleLike() {
    this.likes++;
    this.dispatchEvent(
      new CustomEvent("card-liked", {
        detail: { title: this.title, likes: this.likes },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleShare() {
    this.views++;
    alert(`Sharing: ${this.title}`);
  }

  render() {
    return html`
      <div class="card">
        <div class="card-header">
          <h2>${this.title}</h2>
          ${this.badge ? html`<span class="badge">${this.badge}</span>` : ""}
        </div>
        
        <div class="card-content">
          <p>${this.description}</p>
        </div>
        
        <div class="card-footer">
          <button class="primary" @click=${this.handleLike}>
            ❤️ Like
          </button>
          <button class="secondary" @click=${this.handleShare}>
            🔗 Share
          </button>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${this.likes}</div>
            <div class="stat-label">Likes</div>
          </div>
          <div class="stat">
            <div class="stat-value">${this.views}</div>
            <div class="stat-label">Views</div>
          </div>
        </div>
        
        <div class="info">
          💡 All styles are scoped to this component using Shadow DOM.
          They won't affect or be affected by global styles.
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lit-card": LitCard;
  }
}
