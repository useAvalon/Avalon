import { useEffect, useRef } from "preact/hooks";
import styles from "./HalftoneBg.module.css";

/* ============================================================================
   HalftoneBg
   ----------------------------------------------------------------------------
   A static halftone pattern — one frame, drawn once, held. Muted dots on the
   CTA band so the page has a consistent "dot" texture without running an
   animation loop. Redraws on resize only.
   ============================================================================ */

interface Props {
	/** Dot fill color — defaults to white (for dark backgrounds). */
	color?: string;
	/** Peak alpha for the brightest dots. */
	maxAlpha?: number;
}

export default function HalftoneBg({ color = "#FFFFFF", maxAlpha = 0.12 }: Readonly<Props>) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const wrapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const S = 18; // larger cell = calmer density

		const draw = () => {
			const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
			const w = wrap.clientWidth;
			const h = wrap.clientHeight;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(dpr, dpr);
			ctx.clearRect(0, 0, w, h);

			const cols = Math.ceil(w / S);
			const rows = Math.ceil(h / S);

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const cx = col * S + S / 2;
					const cy = row * S + S / 2;
					// Stable smooth field — no time component, no animation
					const n =
						Math.sin(col * 0.32) * Math.cos(row * 0.38) + Math.sin(col * 0.17 + row * 0.21) * 0.5;
					const v = (n + 1.5) / 3; // 0..1 roughly
					if (v < 0.45) continue;
					const alpha = ((v - 0.45) / 0.55) * maxAlpha;
					ctx.globalAlpha = alpha;
					ctx.fillStyle = color;
					ctx.beginPath();
					ctx.arc(cx, cy, S / 2 - 3.5, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
		};

		const ro = new ResizeObserver(draw);
		ro.observe(wrap);
		draw();

		return () => ro.disconnect();
	}, [color, maxAlpha]);

	return (
		<div ref={wrapRef} class={styles.wrap} aria-hidden="true">
			<canvas ref={canvasRef} class={styles.canvas} />
		</div>
	);
}
