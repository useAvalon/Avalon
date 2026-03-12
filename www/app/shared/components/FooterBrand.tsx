/** @jsxImportSource preact */
import { useEffect, useRef } from 'preact/hooks';
import styles from './FooterBrand.module.css';

const AURORA_COLORS = [
	{ r: 31,  g: 106, b: 211 },
	{ r: 44,  g: 161, b: 179 },
	{ r: 95,  g: 178, b: 182 },
	{ r: 22,  g: 60,  b: 109 },
	{ r: 31,  g: 106, b: 211 },
];

function lerpColor(
	a: { r: number; g: number; b: number },
	b: { r: number; g: number; b: number },
	t: number,
) {
	return {
		r: Math.round(a.r + (b.r - a.r) * t),
		g: Math.round(a.g + (b.g - a.g) * t),
		b: Math.round(a.b + (b.b - a.b) * t),
	};
}

function getAuroraColor(t: number): string {
	const scaled = t * (AURORA_COLORS.length - 1);
	const idx = Math.floor(scaled);
	const frac = scaled - idx;
	const a = AURORA_COLORS[Math.min(idx, AURORA_COLORS.length - 1)];
	const b = AURORA_COLORS[Math.min(idx + 1, AURORA_COLORS.length - 1)];
	const c = lerpColor(a, b, frac);
	return `${c.r},${c.g},${c.b}`;
}

function sampleTextOutline(
	text: string,
	font: string,
	w: number,
	h: number,
	step = 2,
): Array<{ x: number; y: number }> {
	const off = document.createElement('canvas');
	off.width = w;
	off.height = h;
	const ctx = off.getContext('2d');
	if (!ctx) return [];
	ctx.font = font;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#fff';
	ctx.fillText(text, w / 2, h / 2);


	const { data } = ctx.getImageData(0, 0, w, h);
	const points: Array<{ x: number; y: number }> = [];

	for (let y = 1; y < h - 1; y += step) {
		for (let x = 1; x < w - 1; x += step) {
			const i = (y * w + x) * 4;
			if (data[i + 3] < 20) continue;
			const neighbours = [
				data[((y - 1) * w + x) * 4 + 3],
				data[((y + 1) * w + x) * 4 + 3],
				data[(y * w + (x - 1)) * 4 + 3],
				data[(y * w + (x + 1)) * 4 + 3],
			];
			if (neighbours.some(a => a < 20)) {
				points.push({ x, y });
			}
		}
	}

	const cx = w / 2;
	const cy = h / 2;
	points.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
	return points;
}

interface Orb {
	progress: number;
	speed: number;
	size: number;
	colorOffset: number;
	trail: Array<{ x: number; y: number }>;
}

export default function FooterBrand() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const cvs: HTMLCanvasElement = canvas;
		const c: CanvasRenderingContext2D = ctx;
		const w: HTMLDivElement = wrap;

		let points: Array<{ x: number; y: number }> = [];
		let orbs: Orb[] = [];
		let raf = 0;

		function resize() {
			const rect = w.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			cvs.width = rect.width * dpr;
			cvs.height = rect.height * dpr;
			cvs.style.width = rect.width + 'px';
			cvs.style.height = rect.height + 'px';
			c.setTransform(dpr, 0, 0, dpr, 0, 0);

			const fontSize = Math.min(260, Math.max(100, rect.width * 0.24));
			const font = `800 ${fontSize}px 'Instrument Sans', system-ui, sans-serif`;
			points = sampleTextOutline('Avalon', font, Math.round(rect.width), Math.round(rect.height), 2);

			orbs = Array.from({ length: 5 }, (_, i) => ({
				progress: i / 5,
				speed: 0.0007 + Math.random() * 0.0006,
				size: 20 + Math.random() * 14,
				colorOffset: i / 5,
				trail: [],
			}));
		}


		function draw() {
			const rect = w.getBoundingClientRect();
			c.clearRect(0, 0, rect.width, rect.height);
			if (points.length === 0) return;

			const now = performance.now() / 1000;

			for (const orb of orbs) {
				orb.progress = (orb.progress + orb.speed) % 1;
				const idx = Math.floor(orb.progress * points.length);
				const pt = points[idx];
				if (!pt) continue;

				orb.trail.push({ x: pt.x, y: pt.y });
				if (orb.trail.length > 30) orb.trail.shift();

				const colorT = ((orb.colorOffset + now * 0.12) % 1 + 1) % 1;
				const rgb = getAuroraColor(colorT);

				for (let t = 0; t < orb.trail.length; t++) {
					const tp = orb.trail[t];
					const frac = t / orb.trail.length;
					const alpha = frac * 0.55;
					const radius = Math.max(1, orb.size * frac * 0.65);
					const grad = c.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, radius);
					grad.addColorStop(0, `rgba(${rgb},${alpha})`);
					grad.addColorStop(1, `rgba(${rgb},0)`);
					c.beginPath();
					c.arc(tp.x, tp.y, radius, 0, Math.PI * 2);
					c.fillStyle = grad;
					c.fill();
				}

				const coreGrad = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, orb.size);
				coreGrad.addColorStop(0, `rgba(${rgb},1)`);
				coreGrad.addColorStop(0.35, `rgba(${rgb},0.55)`);
				coreGrad.addColorStop(1, `rgba(${rgb},0)`);
				c.beginPath();
				c.arc(pt.x, pt.y, orb.size, 0, Math.PI * 2);
				c.fillStyle = coreGrad;
				c.fill();

				c.beginPath();
				c.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
				c.fillStyle = 'rgba(255,255,255,0.95)';
				c.fill();
			}
		}

		function loop() {
			draw();
			raf = requestAnimationFrame(loop);
		}

		resize();
		loop();

		const ro = new ResizeObserver(resize);
		ro.observe(wrap);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, []);

	return (
		<div className={styles.wrap} ref={wrapRef} aria-hidden="true">
			<span className={styles.text}>Avalon</span>
			<canvas className={styles.canvas} ref={canvasRef} />
		</div>
	);
}
