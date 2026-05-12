import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./BentoFeatures.module.css";

/* ============================================================================
   BentoFeatures
   ----------------------------------------------------------------------------
   A bento grid of 9 feature cards, each with a unique visual that
   demonstrates (not just describes) the feature. Mixed sizes for rhythm.

   Animations are triggered once on scroll-in via IntersectionObserver.
   All motion is CSS-driven except the counter and typewriter which use
   lightweight JS intervals.
   ============================================================================ */

export default function BentoFeatures() {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					io.disconnect();
				}
			},
			{ threshold: 0.1 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<div ref={rootRef} class={`${styles.grid} ${visible ? styles.visible : ""}`}>
			{/* ── Row 1: 3 cards (2 + 1) ── */}
			<ZeroJsCard visible={visible} />
			<HydrationCard />
			<FrameworksCard />

			{/* ── Row 2: 3 cards (1 + 2) ── */}
			<FileRoutingCard visible={visible} />
			<StreamingCard />
			<ApiRoutesCard visible={visible} />

			{/* ── Row 3: 3 cards (1 + 1 + 1) ── */}
			<ImageCard />
			<MiddlewareCard />
			<EdgeCard />
		</div>
	);
}

/* ───────────────────── ZERO JS ───────────────────── */
/* Large card. Animated counter: 847 KB → 0 KB on reveal. */

function ZeroJsCard({ visible }: Readonly<{ visible: boolean }>) {
	const [count, setCount] = useState(847);

	useEffect(() => {
		if (!visible) return;
		const start = 847;
		const duration = 1800;
		const startTime = performance.now();

		const tick = () => {
			const elapsed = performance.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			// Ease out cubic
			const eased = 1 - (1 - progress) ** 3;
			setCount(Math.round(start * (1 - eased)));
			if (progress < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}, [visible]);

	return (
		<article class={`${styles.card} ${styles.cardLg} ${styles.cardZero}`}>
			<div class={styles.cardVisual}>
				<span class={styles.zeroNum}>{count}</span>
				<span class={styles.zeroUnit}>KB</span>
			</div>
			<div class={styles.cardCopy}>
				<h3>Zero JavaScript, by default</h3>
				<p>
					Pages ship no client-side JavaScript unless a component is explicitly marked as an island.
				</p>
			</div>
		</article>
	);
}

/* ───────────────────── PARTIAL HYDRATION ───────────────────── */
/* Four squares — three grey, one pulsing blue. */

function HydrationCard() {
	return (
		<article class={`${styles.card} ${styles.cardHydration}`}>
			<div class={styles.cardVisual}>
				<div class={styles.hydrationRow}>
					<span class={styles.hydrationBlock} />
					<span class={styles.hydrationBlock} />
					<span class={`${styles.hydrationBlock} ${styles.hydrationActive}`} />
					<span class={styles.hydrationBlock} />
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Partial hydration</h3>
				<p>Each island hydrates independently. Static regions never load a runtime.</p>
			</div>
		</article>
	);
}

/* ───────────────────── MULTI-FRAMEWORK ───────────────────── */
/* Framework logos in a tight cluster with brand-color dots. */

const FW_LOGOS = [
	{ name: "React", icon: "/frameworks/react.svg", color: "#61DAFB" },
	{ name: "Vue", icon: "/frameworks/vue.svg", color: "#41B883" },
	{ name: "Svelte", icon: "/frameworks/svelte.svg", color: "#FF3E00" },
	{ name: "Solid", icon: "/frameworks/solid.svg", color: "#4F88C6" },
	{ name: "Preact", icon: "/frameworks/preact.svg", color: "#673AB8" },
	{ name: "Qwik", icon: "/frameworks/qwik.svg", color: "#009DFD" },
	{ name: "Lit", icon: "/frameworks/lit.svg", color: "#325CFF" },
];

function FrameworksCard() {
	return (
		<article class={`${styles.card} ${styles.cardFrameworks}`}>
			<div class={styles.cardVisual}>
				<div class={styles.fwCluster}>
					{FW_LOGOS.map((fw) => (
						<div key={fw.name} class={styles.fwItem}>
							<span class={styles.fwDot} style={{ background: fw.color }} />
							<img src={fw.icon} alt={fw.name} width={24} height={24} loading="lazy" />
						</div>
					))}
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Multi-framework</h3>
				<p>Use any combination in the same project.</p>
			</div>
		</article>
	);
}

/* ───────────────────── FILE ROUTING ───────────────────── */
/* Typewriter file tree that types out paths on reveal. */

const FILE_LINES = [
	"pages/",
	"├── index.tsx",
	"├── blog/[slug].tsx",
	"├── docs/[...path].tsx",
	"└── api/users.ts",
];

function FileRoutingCard({ visible }: Readonly<{ visible: boolean }>) {
	const [lines, setLines] = useState(0);

	useEffect(() => {
		if (!visible) return;
		let i = 0;
		const interval = setInterval(() => {
			i++;
			setLines(i);
			if (i >= FILE_LINES.length) clearInterval(interval);
		}, 280);
		return () => clearInterval(interval);
	}, [visible]);

	return (
		<article class={`${styles.card} ${styles.cardRouting}`}>
			<div class={`${styles.cardVisual} ${styles.cardVisualLeft}`}>
				<pre class={styles.routingTree}>
					{FILE_LINES.slice(0, lines).join("\n")}
					<span class={styles.cursor}>│</span>
				</pre>
			</div>
			<div class={styles.cardCopy}>
				<h3>File-based routing</h3>
				<p>The filesystem is the router. No config.</p>
			</div>
		</article>
	);
}

/* ───────────────────── STREAMING SSR ───────────────────── */
/* A chunked progress bar that fills in steps. */

function StreamingCard() {
	return (
		<article class={`${styles.card} ${styles.cardStreaming}`}>
			<div class={`${styles.cardVisual} ${styles.cardVisualFull}`}>
				<div class={styles.streamBar}>
					<span class={styles.streamChunk} style={{ width: "35%" }} />
					<span class={styles.streamChunk} style={{ width: "25%" }} />
					<span class={styles.streamChunk} style={{ width: "20%" }} />
					<span class={styles.streamChunk} style={{ width: "20%" }} />
				</div>
				<div class={styles.streamLabels}>
					<span>shell</span>
					<span>content</span>
					<span>islands</span>
					<span>late</span>
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Streaming SSR</h3>
				<p>HTML arrives in chunks. First byte is near-instant.</p>
			</div>
		</article>
	);
}

/* ───────────────────── API ROUTES ───────────────────── */
/* Mini request/response that fades in the response. */

function ApiRoutesCard({ visible }: Readonly<{ visible: boolean }>) {
	return (
		<article class={`${styles.card} ${styles.cardLg} ${styles.cardApi}`}>
			<div class={styles.cardVisual}>
				<div class={styles.apiExchange}>
					<div class={styles.apiReq}>
						<span class={styles.apiMethod}>GET</span>
						<span class={styles.apiPath}>/api/users/42</span>
					</div>
					<div class={`${styles.apiRes} ${visible ? styles.apiResVisible : ""}`}>
						<span class={styles.apiStatus}>200</span>
						<pre class={styles.apiBody}>{`{ "id": 42, "name": "Ada" }`}</pre>
					</div>
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Typed API routes</h3>
				<p>
					Server endpoints alongside your pages. Full request access, typed params, any backend
					resource.
				</p>
			</div>
		</article>
	);
}

/* ───────────────────── IMAGE OPTIMIZATION ───────────────────── */
/* Blur → sharp transition on a gradient placeholder. */

function ImageCard() {
	return (
		<article class={`${styles.card} ${styles.cardImage}`}>
			<div class={`${styles.cardVisual} ${styles.cardVisualFull}`}>
				<div class={styles.imgDemo} />
				<div class={styles.imgMeta}>
					<span>webp</span>
					<span>·</span>
					<span>1200×630</span>
					<span>·</span>
					<span>42 KB</span>
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Image optimization</h3>
				<p>Modern formats, no layout shift, built-in.</p>
			</div>
		</article>
	);
}

/* ───────────────────── MIDDLEWARE ───────────────────── */
/* Stacked colored layers. */

function MiddlewareCard() {
	return (
		<article class={`${styles.card} ${styles.cardMiddleware}`}>
			<div class={`${styles.cardVisual} ${styles.cardVisualFull}`}>
				<div class={styles.mwStack}>
					<span class={styles.mwLayer} data-label="auth" />
					<span class={styles.mwLayer} data-label="logging" />
					<span class={styles.mwLayer} data-label="handler" />
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Middleware</h3>
				<p>Auth, redirects, logging — scoped or global.</p>
			</div>
		</article>
	);
}

/* ───────────────────── EDGE DEPLOYMENT ───────────────────── */
/* Dot map with pulsing locations. */

function EdgeCard() {
	return (
		<article class={`${styles.card} ${styles.cardEdge}`}>
			<div class={styles.cardVisual}>
				<div class={styles.edgeMap}>
					<span class={styles.edgeDot} style={{ top: "30%", left: "20%" }} />
					<span class={styles.edgeDot} style={{ top: "35%", left: "48%" }} />
					<span class={styles.edgeDot} style={{ top: "45%", left: "72%" }} />
					<span class={styles.edgeDot} style={{ top: "60%", left: "35%" }} />
					<span class={styles.edgeDot} style={{ top: "25%", left: "80%" }} />
				</div>
			</div>
			<div class={styles.cardCopy}>
				<h3>Edge deployment</h3>
				<p>Deploy to any Nitro target. One build, every runtime.</p>
			</div>
		</article>
	);
}
