(() => {
	const canvas = document.getElementById("grid-pulse-canvas");
	if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const GRID = 48;
	const TRAIL_PX = GRID * 5;

	// Routes in grid units relative to center.
	// Content is roughly ±7 x ±5 grid cells — routes stay OUTSIDE that zone.
	const routeDefs = [
		// Top-left: horizontal right, corner down
		{
			waypoints: [
				[-14, -7],
				[-2, -7],
				[-2, -5],
			],
			hue: 195,
			speed: 4,
			delay: 0,
		},
		// Top-right: comes from far right, goes left, turns down
		{
			waypoints: [
				[14, -6],
				[3, -6],
				[3, -4],
			],
			hue: 210,
			speed: 3.5,
			delay: 60,
		},
		// Left side: vertical down, corner right, down again (zigzag)
		{
			waypoints: [
				[-9, -8],
				[-9, -2],
				[-7, -2],
				[-7, 3],
			],
			hue: 195,
			speed: 3,
			delay: 30,
		},
		// Right side: vertical down then corner left
		{
			waypoints: [
				[9, -6],
				[9, 2],
				[7, 2],
			],
			hue: 210,
			speed: 3.2,
			delay: 100,
		},
		// Bottom-left: horizontal right across bottom
		{
			waypoints: [
				[-12, 6],
				[0, 6],
				[0, 8],
			],
			hue: 195,
			speed: 4.5,
			delay: 150,
		},
		// Bottom-right: comes from right, zigzags left-up
		{
			waypoints: [
				[13, 7],
				[5, 7],
				[5, 5],
				[2, 5],
			],
			hue: 210,
			speed: 3.8,
			delay: 80,
		},
	];

	let beams = [];
	let cx, cy;

	function resize() {
		const section = canvas.closest("section");
		canvas.width = section ? section.offsetWidth : globalThis.innerWidth;
		canvas.height = section ? section.offsetHeight : globalThis.innerHeight;
		cx = Math.round(canvas.width / 2 / GRID) * GRID;
		cy = Math.round(canvas.height / 2 / GRID) * GRID;
		buildBeams();
	}

	function buildBeams() {
		beams = [];
		for (const def of routeDefs) {
			const pts = def.waypoints.map((wp) => ({ x: cx + wp[0] * GRID, y: cy + wp[1] * GRID }));
			const segments = [];
			let totalLen = 0;
			for (let j = 1; j < pts.length; j++) {
				const len = Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y);
				segments.push({ from: pts[j - 1], to: pts[j], len: len, cumLen: totalLen });
				totalLen += len;
			}
			beams.push({
				segments,
				totalLen,
				hue: def.hue,
				speed: def.speed,
				dist: -def.delay,
				alpha: 0.2 + Math.random() * 0.1,
			});
		}
	}

	function posAtDist(beam, d) {
		if (d <= 0) return { x: beam.segments[0].from.x, y: beam.segments[0].from.y };
		for (const seg of beam.segments) {
			if (d <= seg.cumLen + seg.len) {
				const t = (d - seg.cumLen) / seg.len;
				return {
					x: seg.from.x + (seg.to.x - seg.from.x) * t,
					y: seg.from.y + (seg.to.y - seg.from.y) * t,
				};
			}
		}
		const last = beam.segments[beam.segments.length - 1].to;
		return { x: last.x, y: last.y };
	}

	function ease(t) {
		return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
	}

	function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (const b of beams) {
			const progress = Math.max(0, b.dist) / b.totalLen;
			const speedMult = 0.5 + ease(progress < 0.5 ? progress * 2 : (1 - progress) * 2) * 0.7;
			b.dist += b.speed * speedMult;

			if (b.dist < 0) continue;

			const headDist = Math.min(b.dist, b.totalLen);
			const tailDist = Math.max(0, headDist - TRAIL_PX);

			// Fade envelope
			const p = headDist / b.totalLen;
			let envelope = 1;
			if (p < 0.15) envelope = p / 0.15;
			else if (p > 0.8) envelope = (1 - p) / 0.2;

			// Loop when done
			if (b.dist > b.totalLen + TRAIL_PX + 60) {
				b.dist = -(40 + Math.random() * 120);
				continue;
			}

			if (headDist <= 0) continue;

			// Draw trail as segmented gradient
			const steps = 24;
			const stepDist = (headDist - tailDist) / steps;
			for (let s = 0; s < steps; s++) {
				const p0 = posAtDist(b, tailDist + s * stepDist);
				const p1 = posAtDist(b, tailDist + (s + 1) * stepDist);
				const a = ((s + 1) / steps) * b.alpha * envelope;
				if (a < 0.003) continue;

				ctx.beginPath();
				ctx.moveTo(p0.x, p0.y);
				ctx.lineTo(p1.x, p1.y);
				ctx.strokeStyle = "hsla(" + b.hue + ", 70%, 65%, " + a + ")";
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		requestAnimationFrame(draw);
	}

	resize();
	globalThis.addEventListener("resize", resize);
	requestAnimationFrame(draw);
})();
