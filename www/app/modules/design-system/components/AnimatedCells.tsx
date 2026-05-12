import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════
//  STATIC CELL COMPOSITIONS
// ═══════════════════════════════════════════

interface CellResult {
	bg: string;
	opacity?: number;
	radius?: number;
}

type CellGenerator = (x: number, y: number, cols: number, rows: number) => CellResult;

function StaticCellGrid({
	cols,
	rows,
	generator,
	cellSize = 5,
	gap = 2,
}: {
	cols: number;
	rows: number;
	generator: CellGenerator;
	cellSize?: number;
	gap?: number;
}) {
	const cells: CellResult[][] = [];
	for (let y = 0; y < rows; y++) {
		const row: CellResult[] = [];
		for (let x = 0; x < cols; x++) {
			row.push(generator(x, y, cols, rows));
		}
		cells.push(row);
	}
	return (
		<div style={{ display: "flex", flexDirection: "column", gap }}>
			{cells.map((row, y) => (
				<div key={y} style={{ display: "flex", gap }}>
					{row.map((cell, x) => (
						<div
							key={x}
							style={{
								width: cellSize,
								height: cellSize,
								borderRadius: cell.radius || 1,
								background: cell.bg,
								opacity: cell.opacity ?? 1,
							}}
						/>
					))}
				</div>
			))}
		</div>
	);
}

export const staticCellPatterns = [
	{
		name: "Radial Burst",
		desc: "Intensity radiates from center — hero accent, focal point behind logo",
		cols: 50,
		rows: 22,
		gen: ((x: number, y: number, cols: number, rows: number) => {
			const cx = cols / 2,
				cy = rows / 2;
			const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
			const maxDist = Math.sqrt(cx * cx + cy * cy);
			const n = 1 - dist / maxDist;
			const intensity = n ** 2;
			if (intensity < 0.05) return { bg: "rgba(31,106,211,0.03)", opacity: 1 };
			const isCyan = intensity > 0.6 && (x + y) % 3 === 0;
			const isTeal = intensity > 0.8;
			return {
				bg: isTeal ? "#5FB2B6" : isCyan ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.95, intensity * 1.2),
				radius: intensity > 0.7 ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Noise Field",
		desc: "Organic clusters — texture behind cards, section backgrounds",
		cols: 55,
		rows: 20,
		gen: ((x: number, y: number) => {
			const n =
				Math.sin(x * 0.4 + 1.2) * Math.cos(y * 0.5 + 0.8) * Math.sin((x + y) * 0.25 + 2.1) +
				Math.sin(x * 0.7 + 3.0) * Math.cos(y * 0.35 + 1.5) * 0.5;
			if (n < 0.05) return { bg: "rgba(31,106,211,0.03)" };
			const bright = n > 0.6;
			const edge = n > 0 && n < 0.25;
			return {
				bg: bright ? "#5FB2B6" : edge ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.9, 0.15 + n * 0.65),
				radius: bright ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Diagonal Gradient",
		desc: "Corner-to-corner density shift — background texture, page sections",
		cols: 55,
		rows: 20,
		gen: ((x: number, y: number, cols: number, rows: number) => {
			const t = (x / cols + y / rows) / 2;
			const noise = Math.sin(x * 1.7) * Math.cos(y * 2.3) * 0.5 + 0.5;
			const show = noise > 1 - t * 1.3;
			if (!show) return { bg: "rgba(31,106,211,0.03)" };
			const intensity = t * noise;
			return {
				bg: intensity > 0.5 ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.85, 0.1 + intensity * 0.8),
				radius: intensity > 0.6 ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Horizon Band",
		desc: "Dense center band fading to edges — section divider, header bg",
		cols: 60,
		rows: 16,
		gen: ((x: number, y: number, cols: number, rows: number) => {
			const cy = rows / 2;
			const bandDist = Math.abs(y - cy) / cy;
			const falloff = 1 - bandDist ** 1.5;
			const xWave = Math.sin(x * 0.25) * 0.3 + 0.7;
			const n = falloff * xWave;
			if (n < 0.15) return { bg: "rgba(31,106,211,0.03)" };
			const bright = n > 0.7 && x % 4 < 2;
			return {
				bg: bright ? "#5FB2B6" : n > 0.5 ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.9, n * 0.9),
				radius: bright ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Scattered Clusters",
		desc: "Islands of density — visual metaphor for islands architecture",
		cols: 55,
		rows: 20,
		gen: ((x: number, y: number) => {
			const c1 = Math.exp(-((x - 10) ** 2 + (y - 5) ** 2) / 30);
			const c2 = Math.exp(-((x - 30) ** 2 + (y - 12) ** 2) / 50);
			const c3 = Math.exp(-((x - 48) ** 2 + (y - 7) ** 2) / 25);
			const c4 = Math.exp(-((x - 20) ** 2 + (y - 16) ** 2) / 35);
			const c5 = Math.exp(-((x - 42) ** 2 + (y - 17) ** 2) / 20);
			const n = Math.max(c1, c2, c3, c4, c5);
			if (n < 0.08) return { bg: "rgba(31,106,211,0.03)" };
			const which = [c1, c2, c3, c4, c5].indexOf(n);
			const isCyan = which % 2 === 0;
			return {
				bg: n > 0.7 ? "#5FB2B6" : isCyan ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.9, n * 1.1),
				radius: n > 0.6 ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Wave Rows",
		desc: "Sine-displaced density per row — flowing, rhythmic texture",
		cols: 55,
		rows: 20,
		gen: ((x: number, y: number) => {
			const phase = y * 0.8;
			const wave = Math.sin(x * 0.3 + phase) * 0.5 + 0.5;
			const secondary = Math.cos(x * 0.15 + y * 0.4) * 0.3 + 0.5;
			const n = wave * 0.7 + secondary * 0.3;
			if (n < 0.35) return { bg: "rgba(31,106,211,0.03)" };
			const intensity = (n - 0.35) / 0.65;
			return {
				bg: intensity > 0.7 ? "#5FB2B6" : intensity > 0.4 ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.85, intensity * 0.9),
				radius: intensity > 0.7 ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Corner Fade",
		desc: "Density from top-left corner — decorative, asymmetric accent",
		cols: 50,
		rows: 22,
		gen: ((x: number, y: number, cols: number, rows: number) => {
			const dist = Math.sqrt(x * x + y * y);
			const maxDist = Math.sqrt(cols * cols + rows * rows) * 0.6;
			const n = Math.max(0, 1 - dist / maxDist);
			const noise = Math.sin(x * 0.9 + y * 0.7) * 0.2 + 0.8;
			const final_ = n * noise;
			if (final_ < 0.08) return { bg: "rgba(31,106,211,0.03)" };
			return {
				bg: final_ > 0.6 ? "#5FB2B6" : final_ > 0.35 ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.9, final_ * 1.1),
				radius: final_ > 0.5 ? 2 : 1,
			};
		}) as CellGenerator,
	},
	{
		name: "Grid Disruption",
		desc: "Regular grid with random dropout — digital, glitchy, structured chaos",
		cols: 50,
		rows: 20,
		gen: ((x: number, y: number) => {
			const gridOn = x % 3 === 0 || y % 3 === 0;
			const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
			const rand = hash - Math.floor(hash);
			const show = gridOn && rand > 0.3;
			if (!show) return { bg: "rgba(31,106,211,0.03)" };
			const intensity = rand;
			return {
				bg: intensity > 0.8 ? "#5FB2B6" : intensity > 0.6 ? "#2CA1B3" : "#1F6AD3",
				opacity: Math.min(0.8, 0.2 + intensity * 0.5),
				radius: 1,
			};
		}) as CellGenerator,
	},
];

// ═══════════════════════════════════════════
//  ANIMATED CELL PATTERNS
// ═══════════════════════════════════════════

export function MagneticField({ cols = 32, rows = 14 }: { cols?: number; rows?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const mouse = useRef({ x: -1000, y: -1000 });
	const cells = useRef<
		Array<{
			div: HTMLDivElement;
			x: number;
			y: number;
			px: number;
			py: number;
			w: number;
			rot: number;
			scale: number;
			opacity: number;
		}>
	>([]);
	const raf = useRef(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const gap = 2;
		const cellW = (el.offsetWidth - (cols - 1) * gap) / cols;
		cells.current = Array.from({ length: cols * rows }, (_, i) => {
			const x = i % cols,
				y = Math.floor(i / cols);
			const div = document.createElement("div");
			div.style.cssText =
				"position:absolute;border-radius:1px;will-change:transform,opacity,background;";
			el.appendChild(div);
			return {
				div,
				x,
				y,
				px: x * (cellW + gap),
				py: y * (cellW + gap),
				w: cellW,
				rot: 0,
				scale: 1,
				opacity: 0.06,
			};
		});
		let running = true;
		const loop = () => {
			if (!running) return;
			const { x: mx, y: my } = mouse.current;
			cells.current.forEach((c) => {
				const cx = c.px + c.w / 2,
					cy = c.py + c.w / 2;
				const dx = cx - mx,
					dy = cy - my,
					dist = Math.sqrt(dx * dx + dy * dy);
				const inf = Math.max(0, 1 - dist / 120);
				c.rot += (((Math.atan2(dy, dx) * 180) / Math.PI) * inf - c.rot) * 0.08;
				c.scale += (1 + inf * 1.8 - c.scale) * 0.1;
				c.opacity += (0.04 + inf * 0.75 - c.opacity) * 0.1;
				c.div.style.transform = `translate(${c.px}px,${c.py}px) rotate(${c.rot}deg) scale(${c.scale})`;
				c.div.style.width = c.div.style.height = `${c.w}px`;
				c.div.style.background =
					inf > 0.3 ? `rgba(44,161,179,${c.opacity})` : `rgba(31,106,211,${c.opacity})`;
			});
			raf.current = requestAnimationFrame(loop);
		};
		loop();
		const onM = (e: MouseEvent) => {
			const r = el.getBoundingClientRect();
			mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
		};
		const onL = () => {
			mouse.current = { x: -1000, y: -1000 };
		};
		el.addEventListener("mousemove", onM);
		el.addEventListener("mouseleave", onL);
		return () => {
			running = false;
			cancelAnimationFrame(raf.current);
			el.removeEventListener("mousemove", onM);
			el.removeEventListener("mouseleave", onL);
			cells.current.forEach((c) => c.div.remove());
		};
	}, [cols, rows]);

	return (
		<div
			ref={ref}
			style={{
				position: "relative",
				width: "100%",
				aspectRatio: `${cols}/${rows}`,
				overflow: "hidden",
				borderRadius: 10,
			}}
		/>
	);
}

export function MorphGrid({ cols = 36, rows = 14 }: { cols?: number; rows?: number }) {
	const [tick, setTick] = useState(0);
	const t = useRef(0);

	useEffect(() => {
		let r = true;
		const loop = () => {
			if (!r) return;
			t.current += 0.015;
			setTick(t.current);
			requestAnimationFrame(loop);
		};
		loop();
		return () => {
			r = false;
		};
	}, []);

	const noise = (x: number, y: number, time: number) =>
		Math.sin(x * 0.4 + time * 0.8) *
			Math.cos(y * 0.5 + time * 0.6) *
			Math.sin((x + y) * 0.3 + time * 0.4) +
		Math.sin(x * 0.7 - time * 0.5) * Math.cos(y * 0.3 + time * 0.9) * 0.5;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{Array.from({ length: rows }, (_, y) => (
				<div key={y} style={{ display: "flex", gap: 2 }}>
					{Array.from({ length: cols }, (_, x) => {
						const n = noise(x, y, tick);
						const on = n > 0.1,
							bright = n > 0.6,
							edge = n > 0 && n < 0.3;
						return (
							<div
								key={x}
								style={{
									width: 5,
									height: 5,
									borderRadius: bright ? 2 : 1,
									background: bright
										? "#5FB2B6"
										: edge
											? "#2CA1B3"
											: on
												? "#1F6AD3"
												: "rgba(31,106,211,0.03)",
									opacity: on ? Math.min(0.9, 0.2 + n * 0.6) : 0.02,
									transform: `scale(${on ? 0.8 + n * 0.3 : 0.5})`,
								}}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}

export function CircuitTrace({ cols = 40, rows = 14 }: { cols?: number; rows?: number }) {
	const [cells, setCells] = useState(() =>
		Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ v: 0, h: 0 }))),
	);
	const trails = useRef<Array<{ x: number; y: number; dir: number; e: number }>>([]);
	const cRef = useRef(cells);

	useEffect(() => {
		trails.current = Array.from({ length: 6 }, () => ({
			x: Math.floor(Math.random() * cols),
			y: Math.floor(Math.random() * rows),
			dir: Math.floor(Math.random() * 4),
			e: 1,
		}));
		let r = true;
		const dirs: [number, number][] = [
			[1, 0],
			[0, 1],
			[-1, 0],
			[0, -1],
		];
		const tick = () => {
			if (!r) return;
			const g = cRef.current.map((row) => row.map((c) => ({ v: c.v * 0.92, h: c.h })));
			trails.current.forEach((t) => {
				if (Math.random() > 0.7) t.dir = (t.dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
				const [dx, dy] = dirs[t.dir];
				t.x = (t.x + dx + cols) % cols;
				t.y = (t.y + dy + rows) % rows;
				g[t.y][t.x] = { v: 1, h: t.e > 0.5 ? 1 : 0 };
				if (Math.random() > 0.995) {
					t.x = Math.floor(Math.random() * cols);
					t.y = Math.floor(Math.random() * rows);
					t.dir = Math.floor(Math.random() * 4);
				}
			});
			cRef.current = g;
			setCells([...g]);
		};
		const id = setInterval(tick, 50);
		return () => {
			r = false;
			clearInterval(id);
		};
	}, [cols, rows]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{cells.map((row, y) => (
				<div key={y} style={{ display: "flex", gap: 2 }}>
					{row.map((c, x) => (
						<div
							key={x}
							style={{
								width: 5,
								height: 5,
								borderRadius: 1,
								background:
									c.v > 0.7
										? c.h
											? "#5FB2B6"
											: "#1F6AD3"
										: c.v > 0.05
											? `rgba(31,106,211,${c.v * 0.8})`
											: "rgba(31,106,211,0.02)",
								boxShadow:
									c.v > 0.7
										? `0 0 6px ${c.h ? "rgba(44,161,179,0.5)" : "rgba(31,106,211,0.5)"}`
										: "none",
							}}
						/>
					))}
				</div>
			))}
		</div>
	);
}

export function WaveCollapse({ cols = 36, rows = 14 }: { cols?: number; rows?: number }) {
	const [tick, setTick] = useState(0);
	const tRef = useRef(0);
	const eps = useRef<Array<{ x: number; y: number; b: number }>>([]);

	useEffect(() => {
		let r = true;
		const loop = () => {
			if (!r) return;
			tRef.current++;
			if (tRef.current % 50 === 0 || eps.current.length === 0) {
				eps.current.push({
					x: Math.floor(Math.random() * cols),
					y: Math.floor(Math.random() * rows),
					b: tRef.current,
				});
				if (eps.current.length > 4) eps.current.shift();
			}
			setTick(tRef.current);
			requestAnimationFrame(loop);
		};
		loop();
		return () => {
			r = false;
		};
	}, [cols, rows]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{Array.from({ length: rows }, (_, y) => (
				<div key={y} style={{ display: "flex", gap: 2 }}>
					{Array.from({ length: cols }, (_, x) => {
						let mi = 0,
							mh = 0;
						eps.current.forEach((ep, idx) => {
							const d = Math.sqrt((x - ep.x) ** 2 + (y - ep.y) ** 2);
							const age = (tick - ep.b) * 0.15;
							const rd = Math.abs(d - age);
							if (rd < 2.5) {
								const int = (1 - rd / 2.5) * Math.max(0, 1 - age / 30);
								if (int > mi) {
									mi = int;
									mh = idx % 2;
								}
							}
						});
						return (
							<div
								key={x}
								style={{
									width: 5,
									height: 5,
									borderRadius: mi > 0.5 ? 2 : 1,
									background:
										mi > 0.05
											? mh
												? `rgba(44,161,179,${mi * 0.9})`
												: `rgba(31,106,211,${mi * 0.9})`
											: "rgba(31,106,211,0.02)",
									transform: `scale(${mi > 0.05 ? 0.7 + mi * 0.6 : 0.6})`,
									boxShadow: mi > 0.6 ? `0 0 4px rgba(44,161,179,${mi * 0.4})` : "none",
								}}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}

export function LifeGrid({ cols = 40, rows = 16 }: { cols?: number; rows?: number }) {
	const [grid, setGrid] = useState(() =>
		Array.from({ length: rows }, () =>
			Array.from({ length: cols }, () => (Math.random() > 0.65 ? 1 : 0)),
		),
	);
	const [gen, setGen] = useState(0);
	const gRef = useRef(grid);
	gRef.current = grid;

	useEffect(() => {
		const tick = () => {
			const g = gRef.current;
			setGrid(
				g.map((row, y) =>
					row.map((cell, x) => {
						let n = 0;
						for (let dy = -1; dy <= 1; dy++)
							for (let dx = -1; dx <= 1; dx++) {
								if (!dx && !dy) continue;
								n += g[(y + dy + rows) % rows][(x + dx + cols) % cols];
							}
						return cell ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
					}),
				),
			);
			setGen((g) => g + 1);
		};
		const id = setInterval(tick, 120);
		return () => clearInterval(id);
	}, [cols, rows]);

	useEffect(() => {
		if (gen > 0 && gen % 200 === 0) {
			setGrid(
				Array.from({ length: rows }, () =>
					Array.from({ length: cols }, () => (Math.random() > 0.65 ? 1 : 0)),
				),
			);
		}
	}, [gen, rows, cols]);

	return (
		<div>
			<div style={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				{grid.map((row, y) => (
					<div key={y} style={{ display: "flex", gap: 1.5 }}>
						{row.map((c, x) => (
							<div
								key={x}
								style={{
									width: 5,
									height: 5,
									borderRadius: 1,
									background: c
										? (x + y) % 5 === 0
											? "#2CA1B3"
											: "#1F6AD3"
										: "rgba(31,106,211,0.03)",
									opacity: c ? 0.85 : 1,
									transition: "background 0.08s",
								}}
							/>
						))}
					</div>
				))}
			</div>
			<div
				style={{
					fontSize: 10,
					color: "#475569",
					fontFamily: "'JetBrains Mono',monospace",
					marginTop: 6,
				}}
			>
				gen {gen}
			</div>
		</div>
	);
}

export function GlitchBlocks({ width = 600, height = 180 }: { width?: number; height?: number }) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		const dpr = window.devicePixelRatio || 1;
		c.width = width * dpr;
		c.height = height * dpr;
		const ctx = c.getContext("2d")!;
		ctx.scale(dpr, dpr);
		let blocks: Array<{
			x: number;
			y: number;
			w: number;
			h: number;
			life: number;
			ml: number;
			dx: number;
			color: string;
			op: number;
		}> = [];
		let frame = 0;
		let running = true;
		const spawn = () => {
			for (let i = 0; i < Math.floor(Math.random() * 6) + 2; i++) {
				blocks.push({
					x: Math.random() * width,
					y: Math.random() * height,
					w: Math.random() * 120 + 20,
					h: Math.random() * 6 + 2,
					life: Math.random() * 15 + 5,
					ml: 20,
					dx: (Math.random() - 0.5) * 8,
					color: Math.random() > 0.4 ? "#1F6AD3" : "#2CA1B3",
					op: Math.random() * 0.5 + 0.2,
				});
			}
		};
		const draw = () => {
			if (!running) return;
			ctx.fillStyle = "rgba(5,5,16,0.3)";
			ctx.fillRect(0, 0, width, height);
			if (frame % 8 === 0 && Math.random() > 0.3) spawn();
			blocks = blocks.filter((b) => b.life > 0);
			blocks.forEach((b) => {
				b.life--;
				b.x += b.dx;
				const f = b.life / b.ml;
				ctx.fillStyle = b.color;
				ctx.globalAlpha = b.op * f;
				ctx.fillRect(b.x, b.y, b.w, b.h);
				if (Math.random() > 0.7) {
					ctx.globalAlpha = b.op * f * 0.3;
					ctx.fillRect(
						b.x + (Math.random() - 0.5) * 20,
						b.y + (Math.random() - 0.5) * 40,
						b.w * 0.6,
						b.h,
					);
				}
			});
			ctx.globalAlpha = 1;
			if (frame % 12 < 3) {
				ctx.fillStyle = "rgba(31,106,211,0.06)";
				ctx.fillRect(0, Math.random() * height, width, 1);
			}
			frame++;
			requestAnimationFrame(draw);
		};
		draw();
		return () => {
			running = false;
		};
	}, [width, height]);

	return (
		<canvas
			ref={ref}
			style={{ width, height, display: "block", borderRadius: 10, background: "#050510" }}
		/>
	);
}

export function RainCells({ cols = 40, rows = 18 }: { cols?: number; rows?: number }) {
	const [grid, setGrid] = useState(() =>
		Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
	);
	const drops = useRef(
		Array.from({ length: 10 }, () => ({
			x: Math.floor(Math.random() * cols),
			y: Math.random() * -10,
			sp: 0.3 + Math.random() * 0.6,
			len: 3 + Math.floor(Math.random() * 5),
		})),
	);

	useEffect(() => {
		let r = true;
		const tick = () => {
			if (!r) return;
			const g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
			drops.current.forEach((d) => {
				d.y += d.sp;
				for (let i = 0; i < d.len; i++) {
					const dy = Math.floor(d.y) - i;
					if (dy >= 0 && dy < rows) g[dy][d.x] = Math.max(g[dy][d.x], 1 - i / d.len);
				}
				if (d.y - d.len > rows) {
					d.y = Math.random() * -15;
					d.x = Math.floor(Math.random() * cols);
					d.sp = 0.3 + Math.random() * 0.6;
					d.len = 3 + Math.floor(Math.random() * 5);
				}
			});
			setGrid(g);
			requestAnimationFrame(tick);
		};
		tick();
		return () => {
			r = false;
		};
	}, [cols, rows]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{grid.map((row, y) => (
				<div key={y} style={{ display: "flex", gap: 2 }}>
					{row.map((v, x) => (
						<div
							key={x}
							style={{
								width: 5,
								height: 5,
								borderRadius: 1,
								background:
									v > 0.8
										? "#5FB2B6"
										: v > 0.01
											? `rgba(31,106,211,${v * 0.8})`
											: "rgba(31,106,211,0.02)",
								boxShadow: v > 0.9 ? "0 0 4px rgba(95,178,182,0.4)" : "none",
							}}
						/>
					))}
				</div>
			))}
		</div>
	);
}

// ═══════════════════════════════════════════
//  PARTICLES & FX
// ═══════════════════════════════════════════

export function ParticleField({
	width = 600,
	height = 240,
	count = 80,
}: {
	width?: number;
	height?: number;
	count?: number;
}) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		const dpr = window.devicePixelRatio || 1;
		c.width = width * dpr;
		c.height = height * dpr;
		const ctx = c.getContext("2d")!;
		ctx.scale(dpr, dpr);
		const ps = Array.from({ length: count }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			vx: (Math.random() - 0.5) * 0.3,
			vy: (Math.random() - 0.5) * 0.3,
			r: Math.random() * 1.5 + 0.5,
			op: Math.random() * 0.5 + 0.3,
			cyan: Math.random() > 0.6,
		}));
		let running = true;
		const draw = () => {
			if (!running) return;
			ctx.clearRect(0, 0, width, height);
			ps.forEach((p) => {
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0) p.x = width;
				if (p.x > width) p.x = 0;
				if (p.y < 0) p.y = height;
				if (p.y > height) p.y = 0;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = p.cyan ? `rgba(44,161,179,${p.op})` : `rgba(31,106,211,${p.op})`;
				ctx.fill();
			});
			for (let i = 0; i < ps.length; i++)
				for (let j = i + 1; j < ps.length; j++) {
					const dx = ps[i].x - ps[j].x,
						dy = ps[i].y - ps[j].y,
						d = Math.sqrt(dx * dx + dy * dy);
					if (d < 70) {
						ctx.beginPath();
						ctx.moveTo(ps[i].x, ps[i].y);
						ctx.lineTo(ps[j].x, ps[j].y);
						ctx.strokeStyle = `rgba(31,106,211,${0.06 * (1 - d / 70)})`;
						ctx.lineWidth = 0.5;
						ctx.stroke();
					}
				}
			requestAnimationFrame(draw);
		};
		draw();
		return () => {
			running = false;
		};
	}, [width, height, count]);

	return <canvas ref={ref} style={{ width, height, display: "block", borderRadius: 10 }} />;
}

export function ScanlineText({ text = "AVALON" }: { text?: string }) {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const id = setInterval(
			() =>
				setProgress((p) => {
					if (p >= 1) {
						clearInterval(id);
						return 1;
					}
					return p + 0.015;
				}),
			30,
		);
		return () => clearInterval(id);
	}, []);

	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?<>{}[]";
	return (
		<div
			style={{
				fontFamily: "'JetBrains Mono',monospace",
				fontSize: 28,
				fontWeight: 700,
				letterSpacing: 6,
				display: "flex",
			}}
		>
			{text.split("").map((ch, i) => {
				const cp = Math.max(0, Math.min(1, (progress - i * 0.08) / 0.3));
				const done = cp >= 1;
				return (
					<span
						key={i}
						style={{
							color: done ? "#1F6AD3" : `rgba(44,161,179,${0.3 + cp * 0.4})`,
							textShadow: done ? "0 0 20px rgba(31,106,211,0.4)" : "none",
							minWidth: 22,
							textAlign: "center" as const,
						}}
					>
						{done ? ch : chars[Math.floor(Math.random() * chars.length)]}
					</span>
				);
			})}
		</div>
	);
}

export function DataStream({ cols = 30, height = 150 }: { cols?: number; height?: number }) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		const w = cols * 14;
		const dpr = window.devicePixelRatio || 1;
		c.width = w * dpr;
		c.height = height * dpr;
		const ctx = c.getContext("2d")!;
		ctx.scale(dpr, dpr);
		const drops = Array.from({ length: cols }, () => ({
			y: Math.random() * -height,
			sp: 0.5 + Math.random() * 1.5,
			chars: Array.from({ length: 12 }, () =>
				String.fromCharCode(33 + Math.floor(Math.random() * 93)),
			),
		}));
		let running = true;
		const draw = () => {
			if (!running) return;
			ctx.fillStyle = "rgba(5,5,16,0.15)";
			ctx.fillRect(0, 0, w, height);
			drops.forEach((d, i) => {
				d.chars.forEach((ch, j) => {
					const y = d.y + j * 13;
					if (y < 0 || y > height) return;
					const fade = j === 0 ? 1 : Math.max(0, 1 - j * 0.12);
					ctx.font = "11px 'JetBrains Mono',monospace";
					ctx.fillStyle = j === 0 ? `rgba(95,178,182,${fade})` : `rgba(31,106,211,${fade * 0.5})`;
					ctx.fillText(ch, i * 14 + 4, y);
				});
				d.y += d.sp;
				if (d.y > height + 160) {
					d.y = Math.random() * -200;
					d.sp = 0.5 + Math.random() * 1.5;
					d.chars = Array.from({ length: 12 }, () =>
						String.fromCharCode(33 + Math.floor(Math.random() * 93)),
					);
				}
			});
			requestAnimationFrame(draw);
		};
		draw();
		return () => {
			running = false;
		};
	}, [cols, height]);

	return (
		<canvas
			ref={ref}
			style={{
				width: cols * 14,
				height,
				display: "block",
				borderRadius: 10,
				background: "#050510",
			}}
		/>
	);
}

// ═══════════════════════════════════════════
//  EXPORTED TAB COMPONENTS
// ═══════════════════════════════════════════

const CELL_ANIMS = [
	{
		id: "magnetic",
		label: "Magnetic Field",
		desc: "Interactive — cells rotate and scale toward cursor",
	},
	{ id: "morph", label: "Morphing Blobs", desc: "Organic shapes morph using layered sine noise" },
	{ id: "circuit", label: "Circuit Trace", desc: "Agents trace decaying luminous pathways" },
	{
		id: "wave",
		label: "Wave Collapse",
		desc: "Ripples expand and interfere from random epicenters",
	},
	{
		id: "life",
		label: "Conway's Life",
		desc: "Cellular automaton — emergent patterns, auto-reseeds",
	},
	{ id: "glitch", label: "Glitch Blocks", desc: "Rectangular artifacts spawn, drift, dissolve" },
	{ id: "rain", label: "Rain Drip", desc: "Droplets fall with bright heads and fading tails" },
];

export function StaticCellsTab({
	chipClass,
	chipActiveClass,
	stageClass,
	stageCClass,
	stageIClass,
	stageTClass,
	stageDClass,
}: {
	chipClass: string;
	chipActiveClass: string;
	stageClass: string;
	stageCClass: string;
	stageIClass: string;
	stageTClass: string;
	stageDClass: string;
}) {
	const [idx, setIdx] = useState(0);
	const p = staticCellPatterns[idx];
	return (
		<div>
			<p
				style={{ fontSize: 13, color: "var(--avalon-storm)", lineHeight: 1.6, margin: "0 0 1rem" }}
			>
				Pre-computed cell compositions — no animation, pure structure. Use as decorative textures,
				section backgrounds, or brand accents.
			</p>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
				{staticCellPatterns.map((pat, i) => (
					<button key={i} class={idx === i ? chipActiveClass : chipClass} onClick={() => setIdx(i)}>
						{pat.name}
					</button>
				))}
			</div>
			<div class={stageClass}>
				<div class={stageCClass} key={idx}>
					<StaticCellGrid cols={p.cols} rows={p.rows} generator={p.gen} />
				</div>
				<div class={stageIClass}>
					<h3 class={stageTClass}>{p.name}</h3>
					<p class={stageDClass}>{p.desc}</p>
				</div>
			</div>
		</div>
	);
}

export function AnimatedCellsTab({
	chipClass,
	chipActiveClass,
	stageClass,
	stageCClass,
	stageIClass,
	stageTClass,
	stageDClass,
}: {
	chipClass: string;
	chipActiveClass: string;
	stageClass: string;
	stageCClass: string;
	stageIClass: string;
	stageTClass: string;
	stageDClass: string;
}) {
	const [cellId, setCellId] = useState("magnetic");
	const [cellKey, setCellKey] = useState(0);

	const renderCellAnim = () => {
		switch (cellId) {
			case "magnetic":
				return <MagneticField cols={36} rows={14} />;
			case "morph":
				return <MorphGrid cols={40} rows={14} />;
			case "circuit":
				return <CircuitTrace cols={44} rows={14} />;
			case "wave":
				return <WaveCollapse cols={40} rows={14} />;
			case "life":
				return <LifeGrid cols={44} rows={16} />;
			case "glitch":
				return <GlitchBlocks width={680} height={180} />;
			case "rain":
				return <RainCells cols={44} rows={18} />;
		}
	};

	const anim = CELL_ANIMS.find((c) => c.id === cellId);

	return (
		<div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
				{CELL_ANIMS.map((c) => (
					<button
						key={c.id}
						class={cellId === c.id ? chipActiveClass : chipClass}
						onClick={() => {
							setCellId(c.id);
							setCellKey((k) => k + 1);
						}}
					>
						{c.label}
					</button>
				))}
			</div>
			<div class={stageClass}>
				<div class={stageCClass} key={cellKey}>
					{renderCellAnim()}
				</div>
				<div class={stageIClass}>
					<h3 class={stageTClass}>{anim?.label}</h3>
					<p class={stageDClass}>{anim?.desc}</p>
				</div>
			</div>
		</div>
	);
}

export function ExtrasTab({
	stageClass,
	stageCClass,
	stageIClass,
	stageTClass,
	stageDClass,
}: {
	stageClass: string;
	stageCClass: string;
	stageIClass: string;
	stageTClass: string;
	stageDClass: string;
}) {
	const items = [
		{
			title: "Particle Field",
			desc: "Floating connected particles",
			el: <ParticleField width={740} height={200} count={70} />,
		},
		{
			title: "Scanline Text",
			desc: "Scrambling character reveal",
			el: <ScanlineText text="AVALON" />,
		},
		{
			title: "Data Stream",
			desc: "Falling character columns",
			el: <DataStream cols={38} height={150} />,
		},
	];
	return (
		<div>
			{items.map((item) => (
				<div key={item.title} class={stageClass} style={{ marginBottom: 14 }}>
					<div
						class={stageIClass}
						style={{ borderTop: "none", borderBottom: "1px solid var(--surface-border)" }}
					>
						<h3 class={stageTClass}>{item.title}</h3>
						<p class={stageDClass}>{item.desc}</p>
					</div>
					<div class={stageCClass}>{item.el}</div>
				</div>
			))}
		</div>
	);
}
