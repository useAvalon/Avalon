/** Client handler for `on:countdown`. Updates `[data-countdown]` then hydrates. */
export function runCountdownDirective(el: HTMLElement, hydrate: () => void, arg?: string): void {
	const parsed = Number.parseInt(arg || "5", 10);
	const seconds = Number.isNaN(parsed) || parsed <= 0 ? 5 : parsed;
	const badge = el.querySelector("[data-countdown]");
	let remaining = seconds;

	const paint = () => {
		if (badge) badge.textContent = `Hydrates in ${remaining}s...`;
	};
	paint();

	const tick = setInterval(() => {
		remaining -= 1;
		paint();
		if (remaining > 0) return;
		clearInterval(tick);
		if (badge && "style" in badge) {
			const node = badge as HTMLElement;
			node.style.transition = "opacity 0.3s";
			node.style.opacity = "0";
			setTimeout(() => node.remove(), 300);
		}
		hydrate();
	}, 1000);
}
