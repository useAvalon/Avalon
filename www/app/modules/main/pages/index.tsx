import BentoFeatures from "../components/BentoFeatures.tsx";
import CompatibilityStrip from "../components/CompatibilityStrip.tsx";
import HalftoneBg from "../components/HalftoneBg.tsx";
import HydrationCycler from "../components/HydrationCycler.tsx";
import IslandSchematic from "../components/IslandSchematic.tsx";
import MultiFrameworkSpread from "../components/MultiFrameworkSpread.tsx";
import styles from "./index.module.css";

export const metadata = {
	title: "Avalon: The Full-Stack Islands Framework",
	description:
		"Avalon is a full-stack islands framework. Author pages in JSX or MDX, add islands from any supported framework, and deploy to any JavaScript runtime.",
};

/* ============================================================================
   Avalon — landing
   Editorial pace. Real code, real names, real numbers.
   One interactive motion (hydration cycler). Everything else holds still.
   ============================================================================ */

export default async function HomePage() {
	return (
		<div class={styles.page}>
			{/* ─── HERO ─── */}
			<section class={styles.hero}>
				<div class={styles.heroCopy}>
					<h1 class={styles.heroTitle}>
						The full-stack <em>islands</em> framework.
					</h1>
					<p class={styles.heroLead}>
						Avalon is a full-stack framework for building fast websites. Author pages in JSX, add
						islands from any supported framework, and deploy to any JavaScript runtime.
					</p>
					<div class={styles.heroCta}>
						<a href="/docs/introduction" class={styles.btnPrimary}>
							Read the docs
						</a>
						<a href="/docs/installation" class={styles.btnGhost}>
							<code>$ bun create-avalon</code>
						</a>
					</div>
				</div>
			</section>

			{/* ─── COMPAT STRIP ─── */}
			<CompatibilityStrip />

			{/* ─── 01 · ARCHITECTURE ─── */}
			<section class={styles.section}>
				<div class={styles.editorialRow}>
					<div class={styles.editorialCopy}>
						<h2 class={styles.sectionTitle}>
							Partial hydration, per <em>island.</em>
						</h2>
						<p class={styles.sectionBody}>
							Pages render to HTML on the server. Interactive components opt into hydration
							individually through the <code class={styles.inline}>island</code> prop, and Avalon
							loads their JavaScript on your chosen condition. The rest of the page stays static.
						</p>
					</div>
					<div class={styles.editorialFigure}>
						<IslandSchematic island={{ condition: "on:visible" }} />
					</div>
				</div>
			</section>

			{/* ─── 02 · PERFORMANCE ─── */}
			<section class={`${styles.section} ${styles.sectionAlt}`}>
				<h2 class={styles.sectionTitle}>Optimized for Core Web Vitals.</h2>
				<p class={styles.sectionBody}>
					Avalon's architecture is designed around the metrics that matter.
				</p>

				<div class={styles.vitals}>
					<div class={styles.vital}>
						<span class={styles.vitalScore}>LCP</span>
						<div class={styles.vitalMeta}>
							<span class={styles.vitalName}>Largest Contentful Paint</span>
							<span class={styles.vitalDesc}>
								HTML streams immediately — no JS required to render content
							</span>
						</div>
					</div>
					<div class={styles.vital}>
						<span class={styles.vitalScore}>INP</span>
						<div class={styles.vitalMeta}>
							<span class={styles.vitalName}>Interaction to Next Paint</span>
							<span class={styles.vitalDesc}>
								Islands hydrate independently — no shared main-thread contention
							</span>
						</div>
					</div>
					<div class={styles.vital}>
						<span class={styles.vitalScore}>CLS</span>
						<div class={styles.vitalMeta}>
							<span class={styles.vitalName}>Cumulative Layout Shift</span>
							<span class={styles.vitalDesc}>
								SSR output matches the hydrated DOM — no reflow on hydration
							</span>
						</div>
					</div>
				</div>
			</section>

			{/* ─── 03 · INTEROPERABILITY ─── */}
			<section class={`${styles.section} ${styles.sectionAlt}`}>
				<h2 class={styles.sectionTitleWide}>
					React and Vue on the <em>same route.</em>
				</h2>
				<p class={styles.sectionBodyWide}>
					Each island compiles through its own renderer and ships as its own chunk. Three frameworks
					on a page is three runtimes, not the union.
				</p>
				<div class={styles.sectionFigureWide}>
					<MultiFrameworkSpread island={{ condition: "on:visible" }} />
				</div>
			</section>

			{/* ─── 03 · PARTIAL HYDRATION ─── */}
			<section class={`${styles.section} ${styles.sectionAlt}`}>
				<h2 class={styles.sectionTitle}>Hydrate on your terms.</h2>
				<p class={styles.sectionBody}>
					Built-in strategies for common patterns. Custom directives for everything else.
				</p>
				<div class={styles.figure}>
					<HydrationCycler island={{ condition: "on:visible" }} />
				</div>
			</section>

			{/* ─── 04 · DEPLOY ─── */}
			<section class={styles.sectionTight}>
				<h2 class={styles.sectionLede}>Deploy wherever you already do.</h2>
				<p class={styles.sectionBody}>
					Avalon builds on Nitro. The same codebase ships to Node, Bun, Deno, Cloudflare, Vercel,
					Netlify, AWS, and Azure.
				</p>
				<ul class={styles.adapters}>
					{ADAPTERS.map((a) => (
						<li key={a.name}>
							<a href="/docs/guides/deployment" class={styles.adapter} title={a.name}>
								<img src={a.icon} alt="" width={18} height={18} />
								<span>{a.name}</span>
							</a>
						</li>
					))}
				</ul>
			</section>

			{/* ─── 05 · BUILT ON ─── */}
			<section class={`${styles.section} ${styles.sectionFoundations}`}>
				<h2 class={styles.sectionTitle}>Proven foundations.</h2>

				<div class={styles.foundationsList}>
					<div class={styles.foundationItem}>
						<span class={styles.foundationNum}>01</span>
						<div class={styles.foundationContent}>
							<h3>
								<a href="https://preactjs.com" target="_blank" rel="noopener noreferrer">
									Preact
								</a>
							</h3>
							<p>
								Pages and layouts render server-side with Preact. JSX authoring, 3KB runtime, hooks
								API. The same component model you already know.
							</p>
						</div>
						<span class={styles.foundationRole}>Renderer</span>
					</div>

					<div class={styles.foundationItem}>
						<span class={styles.foundationNum}>02</span>
						<div class={styles.foundationContent}>
							<h3>
								<a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
									Vite
								</a>
							</h3>
							<p>
								Instant HMR in development. Production builds with per-island code-splitting. Vite 8
								environment API for SSR.
							</p>
						</div>
						<span class={styles.foundationRole}>Bundler</span>
					</div>

					<div class={styles.foundationItem}>
						<span class={styles.foundationNum}>03</span>
						<div class={styles.foundationContent}>
							<h3>
								<a href="https://nitro.build" target="_blank" rel="noopener noreferrer">
									Nitro
								</a>
							</h3>
							<p>
								Universal server engine. API routes, middleware, edge deployment. One codebase, any
								JavaScript runtime.
							</p>
						</div>
						<span class={styles.foundationRole}>Server</span>
					</div>
				</div>
			</section>

			{/* ─── 06 · FEATURES BENTO ─── */}
			<section class={styles.section}>
				<h2 class={styles.sectionTitle}>Everything else you need.</h2>
				<p class={styles.sectionBody}>Beyond islands and hydration — the full toolkit.</p>

				<div class={styles.figure}>
					<BentoFeatures island={{ condition: "on:visible" }} />
				</div>
			</section>

			{/* ─── CTA ─── */}
			<section class={styles.ctaBand}>
				<HalftoneBg island={{ condition: "on:visible" }} maxAlpha={0.1} />
				<div class={styles.ctaInner}>
					<div>
						<h2 class={styles.ctaTitle}>Start shipping in a minute.</h2>
						<p class={styles.ctaSub}>
							Zero config. One command: <code>bun create-avalon</code>.
						</p>
					</div>
					<div class={styles.ctaActions}>
						<a href="/docs/introduction" class={styles.btnWhite}>
							Start building
						</a>
						<a href="https://github.com/useAvalon/Avalon" class={styles.btnOutlineWhite}>
							View on GitHub
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}

/* ───────────────────── data ───────────────────── */

const ADAPTERS = [
	{ name: "Node", icon: "/adapters/node.svg" },
	{ name: "Bun", icon: "/adapters/bun.svg" },
	{ name: "Deno", icon: "/adapters/deno.svg" },
	{ name: "Cloudflare", icon: "/adapters/cloudflare.svg" },
	{ name: "Vercel", icon: "/adapters/vercel.svg" },
	{ name: "Netlify", icon: "/adapters/netlify.svg" },
	{ name: "AWS", icon: "/adapters/aws.svg" },
	{ name: "Azure", icon: "/adapters/azure.svg" },
];
