import { useEffect, useState } from "preact/hooks";
import styles from "./HydrationCycler.module.css";

/* ============================================================================
   HydrationCycler
   ----------------------------------------------------------------------------
   The one interactive moment on the page. Four pill tabs — each a real
   hydration strategy. Selecting one changes both:
     · The caption text (what the strategy does, when to reach for it)
     · A small diagram that depicts the trigger visually.

   Motion is bounded: a single crossfade on selection. Nothing loops.
   Keyboard accessible (arrow keys move between tabs).
   ============================================================================ */

type Strategy = "on:client" | "on:visible" | "on:interaction" | "on:idle";

interface StrategyDef {
	id: Strategy;
	title: string;
	blurb: string;
	when: string;
}

const STRATEGIES: StrategyDef[] = [
	{
		id: "on:client",
		title: "Immediate",
		blurb:
			"Hydrate as soon as the page loads. Use for interactivity that must respond the moment the user arrives.",
		when: "Counters, above-the-fold forms, primary navigation.",
	},
	{
		id: "on:visible",
		title: "On scroll",
		blurb: "Hold the island's JavaScript until the component scrolls into view, then hydrate.",
		when: "Charts, carousels, anything below the fold.",
	},
	{
		id: "on:interaction",
		title: "On interaction",
		blurb:
			"Hold until the first click, hover, or focus. Useful for interactive surfaces users may never touch.",
		when: "Search modals, menus, settings panels, filters.",
	},
	{
		id: "on:idle",
		title: "On idle",
		blurb:
			"Wait for the browser to report spare time via requestIdleCallback, then hydrate in the background.",
		when: "Comment feeds, analytics widgets, non-critical chrome.",
	},
];

export default function HydrationCycler() {
	const [active, setActive] = useState<Strategy>("on:visible");

	// Keyboard navigation across tabs
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (!target?.dataset?.tabStrategy) return;
			const i = STRATEGIES.findIndex((s) => s.id === active);
			if (e.key === "ArrowRight") {
				const next = STRATEGIES[(i + 1) % STRATEGIES.length];
				setActive(next.id);
				document.querySelector<HTMLButtonElement>(`[data-tab-strategy="${next.id}"]`)?.focus();
			}
			if (e.key === "ArrowLeft") {
				const prev = STRATEGIES[(i - 1 + STRATEGIES.length) % STRATEGIES.length];
				setActive(prev.id);
				document.querySelector<HTMLButtonElement>(`[data-tab-strategy="${prev.id}"]`)?.focus();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [active]);

	const current = STRATEGIES.find((s) => s.id === active) ?? STRATEGIES[0];

	return (
		<div class={styles.root}>
			{/* Tabs */}
			<div class={styles.tabs} role="tablist" aria-label="Hydration strategies">
				{STRATEGIES.map((s) => (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={s.id === active}
						data-tab-strategy={s.id}
						class={`${styles.tab} ${s.id === active ? styles.tabActive : ""}`}
						onClick={() => setActive(s.id)}
					>
						<span class={styles.tabCode}>{s.id}</span>
						<span class={styles.tabTitle}>{s.title}</span>
					</button>
				))}
			</div>

			{/* Content pane */}
			<div class={styles.pane} role="tabpanel" aria-labelledby={`tab-${active}`} key={active}>
				<div class={styles.paneCopy}>
					<p class={styles.paneBlurb}>{current.blurb}</p>
					<p class={styles.paneWhen}>
						<span class={styles.paneWhenLabel}>Best for</span>
						{current.when}
					</p>
				</div>

				<div class={styles.paneFigure} aria-hidden="true">
					<StrategyDiagram strategy={active} />
				</div>
			</div>
		</div>
	);
}

/* ──────────────────────────────────────────────────────────────────────
   StrategyDiagram — one small SVG per strategy, each depicting the
   trigger condition. Static (one-shot transition on mount via `key`).
   ────────────────────────────────────────────────────────────────────── */

function StrategyDiagram({ strategy }: Readonly<{ strategy: Strategy }>) {
	switch (strategy) {
		case "on:client":
			return <ImmediateDiagram />;
		case "on:visible":
			return <VisibleDiagram />;
		case "on:interaction":
			return <InteractionDiagram />;
		case "on:idle":
			return <IdleDiagram />;
	}
}

function Frame({ children }: Readonly<{ children: preact.ComponentChildren }>) {
	return (
		<svg viewBox="0 0 180 120" class={styles.diagram} role="presentation" aria-hidden="true">
			<rect x={1} y={1} width={178} height={118} rx={6} class={styles.frame} />
			{children}
		</svg>
	);
}

/* Immediate — island filled & active from the start */
function ImmediateDiagram() {
	return (
		<Frame>
			<text x={10} y={14} class={styles.diagLabel}>
				PAGE LOAD
			</text>
			<line x1={56} y1={11} x2={170} y2={11} class={styles.diagRule} />

			<rect x={18} y={30} width={68} height={10} rx={2} class={styles.diagLineFaint} />
			<rect x={18} y={46} width={100} height={6} rx={2} class={styles.diagLineFaint} />
			<rect x={18} y={56} width={80} height={6} rx={2} class={styles.diagLineFaint} />

			{/* Active island */}
			<rect x={18} y={72} width={144} height={36} rx={4} class={styles.diagIslandActive} />
			<circle cx={30} cy={90} r={3} class={styles.diagPulse} />
			<text x={42} y={93} class={styles.diagIslandText}>
				hydrated
			</text>
		</Frame>
	);
}

/* Visible — island in dotted state until it crosses the viewport */
function VisibleDiagram() {
	return (
		<Frame>
			<text x={10} y={14} class={styles.diagLabel}>
				VIEWPORT CROSSES ISLAND
			</text>
			<line x1={120} y1={11} x2={170} y2={11} class={styles.diagRule} />

			{/* Dashed viewport line scrolling down */}
			<line x1={8} y1={64} x2={172} y2={64} class={styles.diagViewport} />
			<text x={12} y={60} class={styles.diagTinyLabel}>
				viewport
			</text>

			<rect x={18} y={26} width={144} height={28} rx={4} class={styles.diagIslandDormant} />
			<text x={30} y={44} class={styles.diagIslandTextDim}>
				static
			</text>

			<rect x={18} y={76} width={144} height={30} rx={4} class={styles.diagIslandActive} />
			<text x={30} y={95} class={styles.diagIslandText}>
				hydrated
			</text>
		</Frame>
	);
}

/* Interaction — cursor icon touches the island */
function InteractionDiagram() {
	return (
		<Frame>
			<text x={10} y={14} class={styles.diagLabel}>
				ON FIRST INTERACTION
			</text>
			<line x1={110} y1={11} x2={170} y2={11} class={styles.diagRule} />

			<rect x={18} y={28} width={144} height={54} rx={4} class={styles.diagIslandDormant} />
			<text x={30} y={60} class={styles.diagIslandTextDim}>
				waiting…
			</text>

			{/* Cursor + click ripple */}
			<g transform="translate(120 66)" class={styles.diagCursor}>
				<path d="M0 0 L 0 14 L 3.2 10.8 L 6 16 L 8 15 L 5.2 9.8 L 9.4 9.4 Z" />
			</g>
			<circle cx={118} cy={66} r={9} class={styles.diagRipple} />

			<text x={18} y={104} class={styles.diagTinyLabel}>
				click / hover / focus → hydrate
			</text>
		</Frame>
	);
}

/* Idle — "requestIdleCallback" slot opens up */
function IdleDiagram() {
	return (
		<Frame>
			<text x={10} y={14} class={styles.diagLabel}>
				BROWSER IDLE FRAME
			</text>
			<line x1={104} y1={11} x2={170} y2={11} class={styles.diagRule} />

			{/* Frame timeline */}
			<g transform="translate(18 40)">
				{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
					<rect
						key={`f-${i}`}
						x={i * 19}
						y={0}
						width={16}
						height={18}
						rx={1.5}
						class={i === 5 ? styles.diagIdleSlot : styles.diagFrame}
					/>
				))}
				<text x={0} y={-4} class={styles.diagTinyLabel}>
					frames
				</text>
				<text x={95} y={32} class={styles.diagSlotLabel}>
					idle slot → hydrate
				</text>
			</g>

			<rect x={18} y={80} width={144} height={26} rx={4} class={styles.diagIslandActive} />
			<text x={30} y={97} class={styles.diagIslandText}>
				hydrated
			</text>
		</Frame>
	);
}
