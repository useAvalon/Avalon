import { LitElement, html, css } from "lit";

export class WebCounter extends LitElement {
	static elementName = "web-counter";

	static styles = css`
		:host {
			display: block;
			font-family: 'DM Sans', system-ui, sans-serif;
		}

		.counter {
			padding: 24px;
			background: linear-gradient(135deg, rgba(50,79,255,0.1) 0%, rgba(50,79,255,0.02) 100%);
			border: 1px solid rgba(50,79,255,0.15);
			border-radius: 14px;
			text-align: center;
		}

		.label {
			font-size: 14px;
			font-weight: 600;
			color: #324FFF;
			margin-bottom: 16px;
			letter-spacing: 0.03em;
			font-family: 'DM Sans', sans-serif;
		}

		.count {
			font-size: 42px;
			font-weight: 300;
			color: rgba(255,255,255,0.9);
			margin-bottom: 20px;
			font-family: 'DM Sans', sans-serif;
		}

		.buttons {
			display: flex;
			gap: 8px;
			justify-content: center;
		}

		button {
			padding: 10px 20px;
			font-size: 18px;
			background: rgba(50,79,255,0.12);
			color: #fff;
			border: 1px solid rgba(50,79,255,0.2);
			border-radius: 8px;
			cursor: pointer;
			transition: all 0.2s ease;
		}

		button:hover {
			background: rgba(50,79,255,0.2);
		}

		.sublabel {
			margin-top: 14px;
			font-size: 10px;
			color: rgba(255,255,255,0.3);
			text-transform: uppercase;
			letter-spacing: 0.1em;
			font-family: 'DM Sans', sans-serif;
		}
	`;

	static properties = {
		count: { type: Number, attribute: 'initial-count', reflect: true },
	};

	declare count: number;

	constructor() {
		super();
		this.count = 0;
	}

	render() {
		return html`
			<div class="counter">
				<div class="label">🔥 Lit</div>
				<div class="count">${this.count}</div>
				<div class="buttons">
					<button @click=${() => this.count--}>−</button>
					<button @click=${() => this.count++}>+</button>
				</div>
				<div class="sublabel">Web Components</div>
			</div>
		`;
	}
}

customElements.define('web-counter', WebCounter);
export default WebCounter;
