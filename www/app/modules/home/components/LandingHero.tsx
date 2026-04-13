/** @jsxImportSource preact */

import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useEffect, useRef } from "preact/hooks";
import styles from "./LandingHero.module.css";

// Framework icon component using external SVG files
// biome-ignore lint/correctness/useQwikValidLexicalScope: This is a Preact component, not Qwik
const FwImg = ({ name, alt }: { name: string; alt: string }) => (
	<img src={`/frameworks/${name}.svg`} alt={alt} width="24" height="24" loading="lazy" />
);

const frameworks = [
	{
		id: "react",
		name: "React",
		color: "#61DAFB",
		side: "left",
		delay: 0,
		icon: "react",
		posClass: styles.cardReact,
	},
	{
		id: "preact",
		name: "Preact",
		color: "#673AB8",
		side: "left",
		delay: 0.8,
		icon: "preact",
		posClass: styles.cardPreact,
	},
	{
		id: "solid",
		name: "Solid",
		color: "#4F88C6",
		side: "left",
		delay: 1.6,
		icon: "solid",
		posClass: styles.cardSolid,
	},
	{
		id: "qwik",
		name: "Qwik",
		color: "#009dfd",
		side: "right",
		delay: 2.4,
		icon: "qwik",
		posClass: styles.cardQwik,
	},
	{
		id: "vue",
		name: "Vue",
		color: "#42B883",
		side: "right",
		delay: 3.2,
		icon: "vue",
		posClass: styles.cardVue,
	},
	{
		id: "svelte",
		name: "Svelte",
		color: "#FF3E00",
		side: "right",
		delay: 4,
		icon: "svelte",
		posClass: styles.cardSvelte,
	},
];

export default function LandingHero() {
	const sceneRef = useRef<HTMLDivElement>(null);
	const pathGroupRef = useRef<SVGGElement>(null);
	const dotGroupRef = useRef<SVGGElement>(null);
	const targetRef = useRef<HTMLDivElement>(null);
	const targetGlowRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const transferRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const animationsRef = useRef<{
		trails: gsap.core.Tween[];
		transfers: gsap.core.Timeline[];
		floats: gsap.core.Tween[];
	}>({ trails: [], transfers: [], floats: [] });

	useEffect(() => {
		gsap.registerPlugin(MotionPathPlugin);

		const scene = sceneRef.current;
		const pathGroup = pathGroupRef.current;
		const dotGroup = dotGroupRef.current;
		const target = targetRef.current;
		if (!scene || !pathGroup || !dotGroup || !target) return;

		function getEdgePoint(el: HTMLElement, side: string) {
			const sceneRect = scene?.getBoundingClientRect();
			if (!sceneRect) return { x: 0, y: 0 };
			const elRect = el.getBoundingClientRect();
			const y = elRect.top - sceneRect.top + elRect.height / 2;
			return side === "left"
				? { x: elRect.right - sceneRect.left, y }
				: { x: elRect.left - sceneRect.left, y };
		}

		function getTargetEdge(side: string) {
			const sceneRect = scene?.getBoundingClientRect();
			const tRect = target?.getBoundingClientRect();
			if (!sceneRect || !tRect) return { x: 0, y: 0 };
			const y = tRect.top - sceneRect.top + tRect.height / 2;
			return side === "left"
				? { x: tRect.left - sceneRect.left, y }
				: { x: tRect.right - sceneRect.left, y };
		}

		function buildBezier(
			from: { x: number; y: number },
			to: { x: number; y: number },
			side: string,
		) {
			const dx = to.x - from.x;
			const cpOffset = Math.abs(dx) * 0.55;
			const cp1 =
				side === "left" ? { x: from.x + cpOffset, y: from.y } : { x: from.x - cpOffset, y: from.y };
			const cp2 =
				side === "left" ? { x: to.x - cpOffset, y: to.y } : { x: to.x + cpOffset, y: to.y };
			return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
		}

		function createOrUpdatePath(
			id: string,
			cls: string,
			d: string,
			extra?: Record<string, string>,
		) {
			let el = document.getElementById(id) as SVGPathElement | null;
			if (!el) {
				el = document.createElementNS("http://www.w3.org/2000/svg", "path");
				el.id = id;
				el.setAttribute("class", cls);
				if (extra)
					Object.entries(extra).forEach(([k, v]) => {
						el?.setAttribute(k, v);
					});
				pathGroup?.appendChild(el);
			}
			el.setAttribute("d", d);
			return el;
		}

		function createOrUpdateCircle(id: string, cx: number, cy: number, r: number, fill: string) {
			let el = document.getElementById(id) as SVGCircleElement | null;
			if (!el) {
				el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				el.id = id;
				el.setAttribute("class", styles.endpointDot);
				el.setAttribute("r", String(r));
				el.setAttribute("fill", fill);
				dotGroup?.appendChild(el);
			}
			el.setAttribute("cx", String(cx));
			el.setAttribute("cy", String(cy));
			return el;
		}

		function buildPaths() {
			frameworks.forEach((fw) => {
				const card = cardRefs.current[fw.id];
				if (!card) return;
				const from = getEdgePoint(card, fw.side);
				const to = getTargetEdge(fw.side);
				const d = buildBezier(from, to, fw.side);

				createOrUpdatePath(`pathGlow-${fw.id}`, styles.bezierPathGlow, d);
				createOrUpdatePath(`path-${fw.id}`, styles.bezierPath, d);
				createOrUpdatePath(`trail-${fw.id}`, styles.activeTrail, d, {
					stroke: `url(#grad-${fw.id})`,
				});
				createOrUpdateCircle(`dot-src-${fw.id}`, from.x, from.y, 3, fw.color);
				createOrUpdateCircle(`dot-tgt-${fw.id}`, to.x, to.y, 3, "rgba(255,255,255,0.2)");
			});
		}

		function startTrails() {
			animationsRef.current.trails.forEach((t) => { t.kill(); });
			animationsRef.current.trails = [];

			frameworks.forEach((fw) => {
				const trail = document.getElementById(`trail-${fw.id}`) as SVGPathElement | null;
				if (!trail) return;
				const len = trail.getTotalLength();
				const seg = len * 0.2;
				trail.style.strokeDasharray = `${seg} ${len - seg}`;
				trail.style.strokeDashoffset = String(len);

				const tw = gsap.to(trail, {
					strokeDashoffset: -len,
					duration: 4 + Math.random() * 2,
					ease: "none",
					repeat: -1,
				});
				animationsRef.current.trails.push(tw);
			});
		}

		function startTransfers() {
			animationsRef.current.transfers.forEach((t) => { t.kill(); });
			animationsRef.current.transfers = [];

			frameworks.forEach((fw) => {
				const transferEl = transferRefs.current[fw.id];
				const pathEl = `#path-${fw.id}`;
				const slotEl = slotRefs.current[fw.id];
				const cardEl = cardRefs.current[fw.id];
				if (!transferEl || !slotEl || !cardEl) return;

				const tl = gsap.timeline({ repeat: -1, repeatDelay: 3, delay: fw.delay });

				tl.set(transferEl, { opacity: 0, scale: 0.2 })
					.to(transferEl, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" })
					.to(
						cardEl,
						{
							borderColor: `${fw.color}4D`,
							boxShadow: `0 0 20px ${fw.color}22`,
							duration: 0.3,
							ease: "power2.out",
						},
						"<",
					)
					.to(cardEl, { borderColor: "rgba(255,255,255,0.06)", boxShadow: "none", duration: 0.6 })
					.to(
						transferEl,
						{
							motionPath: {
								path: pathEl,
								align: pathEl,
								alignOrigin: [0.5, 0.5],
								autoRotate: false,
							},
							duration: 2.2,
							ease: "power2.inOut",
						},
						"-=0.6",
					)
					.to(transferEl, { opacity: 0, scale: 0.4, duration: 0.3, ease: "power2.in" }, "-=0.3")
					.call(() => {
						slotEl.classList.add(styles.slotActive);
						if (targetGlowRef.current) {
							gsap.to(targetGlowRef.current, {
								opacity: 1,
								boxShadow: `inset 0 0 40px ${fw.color}15, 0 0 30px ${fw.color}10`,
								duration: 0.3,
								ease: "power2.out",
							});
							gsap.to(targetGlowRef.current, {
								opacity: 0,
								duration: 0.8,
								delay: 0.3,
								ease: "power2.out",
							});
						}
					})
					.to(target, { borderColor: `${fw.color}33`, duration: 0.25, ease: "power2.out" }, "-=0.3")
					.to(target, { borderColor: "rgba(255,255,255,0.06)", duration: 0.8 })
					.call(() => {
						gsap.delayedCall(1.5, () => slotEl.classList.remove(styles.slotActive));
					});

				animationsRef.current.transfers.push(tl);
			});
		}

		function startFloating() {
			animationsRef.current.floats.forEach((t) => { t.kill(); });
			animationsRef.current.floats = [];

			frameworks.forEach((fw, i) => {
				const card = cardRefs.current[fw.id];
				if (!card) return;
				const tw = gsap.to(card, {
					y: i % 2 === 0 ? -4 : 4,
					duration: 3.5 + i * 0.4,
					ease: "sine.inOut",
					yoyo: true,
					repeat: -1,
					delay: i * 0.3,
				});
				animationsRef.current.floats.push(tw);
			});
		}

		function playEntrance() {
			const cards = Object.values(cardRefs.current).filter(Boolean);
			const tl = gsap.timeline();
			// Use .to() with immediateRender so elements start visible
			// and animate to their final positions
			tl.from(cards, {
				opacity: 0,
				scale: 0.85,
				duration: 0.6,
				stagger: { each: 0.1, from: "random" },
				ease: "power2.out",
				immediateRender: true,
			})
				.from(
					target,
					{ opacity: 0, scale: 0.9, duration: 0.7, ease: "power2.out", immediateRender: true },
					"-=0.3",
				)
				.from(
					`#${pathGroupRef.current?.id} path, #${dotGroupRef.current?.id} circle`,
					{ opacity: 0, duration: 0.8, stagger: 0.04, ease: "power2.out" },
					"-=0.4",
				);
		}

		function init() {
			buildPaths();
			startTrails();
			startTransfers();
			startFloating();
			playEntrance();
		}

		let resizeTimeout: ReturnType<typeof setTimeout>;
		function handleResize() {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				animationsRef.current.trails.forEach((t) => { t.kill(); });
				animationsRef.current.transfers.forEach((t) => { t.kill(); });
				buildPaths();
				startTrails();
				startTransfers();
			}, 150);
		}

		window.addEventListener("resize", handleResize);
		requestAnimationFrame(() => requestAnimationFrame(init));

		// Pause/resume animations based on visibility
		const observer = new IntersectionObserver(
			([entry]) => {
				const all = [
					...animationsRef.current.trails,
					...animationsRef.current.transfers,
					...animationsRef.current.floats,
				];
				if (entry.isIntersecting) {
					all.forEach((t) => { t.resume(); });
				} else {
					all.forEach((t) => { t.pause(); });
				}
			},
			{ threshold: 0 },
		);
		observer.observe(scene);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", handleResize);
			animationsRef.current.trails.forEach((t) => { t.kill(); });
			animationsRef.current.transfers.forEach((t) => { t.kill(); });
			animationsRef.current.floats.forEach((t) => { t.kill(); });
		};
	}, []);

	return (
		<div class={styles.scene} ref={sceneRef}>
			<div class={styles.topHeading}>
				<p class={styles.sectionLabel}>Universal Rendering</p>
				<h2 class={styles.heading}>
					One renderer. <span class={styles.headingEm}>Every</span> framework.
				</h2>
				<p class={styles.subtitle}>
					Write components in any framework. Avalon compiles them into lightweight islands through a
					single pipeline.
				</p>
			</div>

			<svg class={styles.curvesSvg}>
				<defs>
					{frameworks.map((fw) => (
						<linearGradient key={fw.id} id={`grad-${fw.id}`}>
							<stop offset="0%" stopColor={`${fw.color}00`} />
							<stop offset="50%" stopColor={`${fw.color}80`} />
							<stop offset="100%" stopColor={`${fw.color}00`} />
						</linearGradient>
					))}
				</defs>
				<g ref={pathGroupRef} id="pathGroup" />
				<g ref={dotGroupRef} id="dotGroup" />
			</svg>

			{frameworks.map((fw) => (
				<div
					key={fw.id}
					class={`${styles.fwCard} ${fw.posClass}`}
					ref={(el) => {
						cardRefs.current[fw.id] = el;
					}}
				>
					<div class={styles.fwIcon}>
						<FwImg name={fw.icon} alt={fw.name} />
					</div>
					<span class={styles.fwName}>{fw.name}</span>
				</div>
			))}

			<div class={styles.targetContainer} ref={targetRef}>
				<div class={styles.targetGlow} ref={targetGlowRef} />
				<div class={styles.targetInner}>
					<div class={styles.targetLabel}>Avalon</div>
					<div class={styles.targetSub}>Universal Renderer</div>
					<div class={styles.collectedGrid}>
						{frameworks.map((fw) => (
							<div
								key={fw.id}
								class={styles.collectedSlot}
								ref={(el) => {
									slotRefs.current[fw.id] = el;
								}}
							>
								<FwImg name={fw.icon} alt={fw.name} />
							</div>
						))}
					</div>
				</div>
			</div>

			{frameworks.map((fw) => {
				const fwClass = styles[`fw${fw.name}`] || "";
				return (
					<div
						key={fw.id}
						class={`${styles.transferEl} ${fwClass}`}
						ref={(el) => {
							transferRefs.current[fw.id] = el;
						}}
					>
						<div class={styles.transferDot}>
							<FwImg name={fw.icon} alt={fw.name} />
						</div>
					</div>
				);
			})}
		</div>
	);
}
