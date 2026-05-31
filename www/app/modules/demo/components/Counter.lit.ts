import { defineLitIsland } from "@useavalon/lit/island";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("lit-counter")
export class LitCounter extends LitElement {
	static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      font-family: system-ui, sans-serif;
      color: #e0e0e0;
      background: linear-gradient(135deg, #2e2e1a 0%, #3e3616 100%);
      border: 1px solid rgba(0, 191, 255, 0.2);
    }
    .header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(0, 191, 255, 0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .label {
      font-size: 0.7rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge {
      font-size: 0.65rem;
      color: #00bfff;
      background: rgba(0, 191, 255, 0.15);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .content {
      padding: 1.5rem;
      text-align: center;
      flex: 1;
    }
    .title {
      margin: 0 0 0.25rem;
      color: #00bfff;
      font-size: 1rem;
    }
    .subtitle {
      margin: 0 0 1rem;
      font-size: 0.75rem;
      opacity: 0.6;
    }
    .count {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 1rem 0;
      font-family: monospace;
    }
    .buttons {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }
    button {
      padding: 0.5rem 1.25rem;
      border-radius: 8px;
      border: 1px solid rgba(0, 191, 255, 0.3);
      background: rgba(0, 191, 255, 0.1);
      color: #00bfff;
      font-size: 1.1rem;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .hint {
      margin-top: 0.75rem;
      font-size: 0.7rem;
      color: #6b7280;
      font-style: italic;
    }
    .network-panel {
      border-top: 1px solid rgba(0, 191, 255, 0.15);
      background: rgba(0, 0, 0, 0.3);
      font-family: monospace;
      font-size: 11px;
    }
    .network-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(0, 191, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
    }
    .network-title { color: #6b7280; font-weight: 500; }
    .network-filter {
      color: #00bfff;
      background: rgba(0, 191, 255, 0.1);
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
    }
    .network-body { padding: 0.5rem 0.75rem; min-height: 32px; }
    .network-row {
      display: grid;
      grid-template-columns: 42px 1fr 50px 50px 45px;
      gap: 0.5rem;
      align-items: center;
    }
    .status { color: #4ade80; font-weight: 500; }
    .pending { color: #6b7280; font-size: 10px; }
    .file { color: #00bfff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-pending { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type { color: #6b7280; }
    .size { color: #9ca3af; text-align: right; }
    .size-pending { color: #6b7280; text-align: right; }
    .time { color: #4ade80; text-align: right; }
    .time-pending { color: #6b7280; text-align: right; }
  `;

	@state() count = 0;
	@state() hydrated = false;
	@state() loadTime: number | null = null;
	@state() fileSize: string | null = null;

	override connectedCallback() {
		super.connectedCallback();
		if (!this.hasAttribute("defer-hydration")) {
			this._activate();
		}
	}

	override attributeChangedCallback(name: string, old: string | null, value: string | null) {
		super.attributeChangedCallback(name, old, value);
		if (name === "defer-hydration" && value === null && !this.hydrated) {
			this.updateComplete.then(() => this._activate());
		}
	}

	private _activate() {
		this.hydrated = true;
		setTimeout(() => {
			const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
			const entry = entries.find(
				(e) =>
					e.name.includes("Counter.lit") &&
					(e.initiatorType === "script" ||
						e.initiatorType === "fetch" ||
						e.initiatorType === "other"),
			);
			if (entry) {
				this.loadTime = Math.round(entry.responseEnd - entry.startTime);
				const bytes = entry.transferSize || entry.encodedBodySize || 0;
				this.fileSize = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;
			} else {
				this.loadTime = 18;
				this.fileSize = "4.1 kB";
			}
		}, 50);
	}

	override render() {
		return html`
      <div class="header">
        <span class="label">Lit Island</span>
        <span class="badge" style="visibility: ${this.hydrated ? "visible" : "hidden"}">Interactive</span>
      </div>

      <div class="content">
        <h3 class="title">Lit Counter</h3>
        <p class="subtitle">Hydrates on interaction</p>
        <div class="count">${this.count}</div>
        <div class="buttons">
          <button @click=${() => this.count--} ?disabled=${!this.hydrated}>−</button>
          <button @click=${() => this.count++} ?disabled=${!this.hydrated}>+</button>
        </div>

      </div>

      <div class="network-panel">
        <div class="network-header">
          <span class="network-title">Network</span>
          <span class="network-filter">JS</span>
        </div>
        <div class="network-body">
          <div class="network-row">
            <span class=${this.hydrated ? "status" : "pending"}>${this.hydrated ? "200" : "pending"}</span>
            <span class=${this.hydrated ? "file" : "file-pending"}>Counter.lit.ts</span>
            <span class="type">script</span>
            <span class=${this.hydrated ? "size" : "size-pending"}>${this.hydrated ? (this.fileSize ?? "...") : "—"}</span>
            <span class=${this.hydrated ? "time" : "time-pending"}>${this.hydrated ? `${this.loadTime ?? "..."}ms` : "—"}</span>
          </div>
        </div>
      </div>
    `;
	}
}

export default defineLitIsland(LitCounter);
