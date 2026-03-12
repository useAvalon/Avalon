/** @jsxImportSource preact */
import { useEffect, useRef } from 'preact/hooks';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import styles from './LandingHero.module.css';

// Framework icons as components
const ReactIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="#61DAFB">
		<circle cx="12" cy="12" r="2.2"/>
		<ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1"/>
		<ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(60 12 12)"/>
		<ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(120 12 12)"/>
	</svg>
);

const PreactIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none">
		<circle cx="12" cy="12" r="2" fill="#673AB8"/>
		<ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(30 12 12)"/>
		<ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(90 12 12)"/>
		<ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(150 12 12)"/>
	</svg>
);

const SolidIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none">
		<path d="M4 6l8-4 8 4v4l-8 4-8-4V6z" fill="#4F88C6" opacity="0.6"/>
		<path d="M4 10l8 4 8-4v4l-8 4-8-4v-4z" fill="#4F88C6" opacity="0.8"/>
		<path d="M4 14l8 4 8-4v4l-8 4-8-4v-4z" fill="#4F88C6"/>
	</svg>
);

const LitIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none">
		<path d="M12 2L6 8l6 4-6 4 6 6 6-6-6-4 6-4z" fill="#324FFF"/>
		<path d="M12 2l6 6-6 4-6-4z" fill="#324FFF" opacity="0.6"/>
	</svg>
);

const VueIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none">
		<path d="M2 3h4l6 10L18 3h4L12 22z" fill="#42B883"/>
		<path d="M6 3h3.5L12 8l2.5-5H18L12 15z" fill="#35495E"/>
	</svg>
);

const SvelteIcon = () => (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="#FF3E00">
		<path d="M19.1 3.5C17.1 1 13.5.5 11 2L5.7 5.5C4.5 6.3 3.7 7.5 3.4 8.8c-.2 1.1-.1 2.3.4 3.3-.3.5-.5 1-.6 1.6-.3 1.3-.1 2.7.5 3.9 2 2.5 5.6 3 8.1 1.5l5.3-3.5c1.2-.8 2-2 2.3-3.3.2-1.1.1-2.3-.4-3.3.3-.5.5-1 .6-1.6.3-1.3.1-2.7-.5-3.9z"/>
	</svg>
);

const frameworks = [
	{ id: 'react', name: 'React', color: '#61DAFB', side: 'left', delay: 0, Icon: ReactIcon, posClass: styles.cardReact },
	{ id: 'preact', name: 'Preact', color: '#673AB8', side: 'left', delay: 0.8, Icon: PreactIcon, posClass: styles.cardPreact },
	{ id: 'solid', name: 'Solid', color: '#4F88C6', side: 'left', delay: 1.6, Icon: SolidIcon, posClass: styles.cardSolid },
	{ id: 'lit', name: 'Lit', color: '#324FFF', side: 'right', delay: 2.4, Icon: LitIcon, posClass: styles.cardLit },
	{ id: 'vue', name: 'Vue', color: '#42B883', side: 'right', delay: 3.2, Icon: VueIcon, posClass: styles.cardVue },
	{ id: 'svelte', name: 'Svelte', color: '#FF3E00', side: 'right', delay: 4, Icon: SvelteIcon, posClass: styles.cardSvelte },
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
	const animationsRef = useRef<{ trails: gsap.core.Tween[], transfers: gsap.core.Timeline[], floats: gsap.core.Tween[] }>({ trails: [], transfers: [], floats: [] });

	useEffect(() => {
		gsap.registerPlugin(MotionPathPlugin);

		const scene = sceneRef.current;
		const pathGroup = pathGroupRef.current;
		const dotGroup = dotGroupRef.current;
		const target = targetRef.current;
		if (!scene || !pathGroup || !dotGroup || !target) return;

		function getEdgePoint(el: HTMLElement, side: string) {
			const sceneRect = scene!.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			const y = elRect.top - sceneRect.top + elRect.height / 2;
			return side === 'left' 
				? { x: elRect.right - sceneRect.left, y }
				: { x: elRect.left - sceneRect.left, y };
		}

		function getTargetEdge(side: string) {
			const sceneRect = scene!.getBoundingClientRect();
			const tRect = target!.getBoundingClientRect();
			const y = tRect.top - sceneRect.top + tRect.height / 2;
			return side === 'left'
				? { x: tRect.left - sceneRect.left, y }
				: { x: tRect.right - sceneRect.left, y };
		}

		function buildBezier(from: {x: number, y: number}, to: {x: number, y: number}, side: string) {
			const dx = to.x - from.x;
			const cpOffset = Math.abs(dx) * 0.55;
			const cp1 = side === 'left' ? { x: from.x + cpOffset, y: from.y } : { x: from.x - cpOffset, y: from.y };
			const cp2 = side === 'left' ? { x: to.x - cpOffset, y: to.y } : { x: to.x + cpOffset, y: to.y };
			return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
		}

		function createOrUpdatePath(id: string, cls: string, d: string, extra?: Record<string, string>) {
			let el = document.getElementById(id) as SVGPathElement | null;
			if (!el) {
				el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				el.id = id;
				el.setAttribute('class', cls);
				if (extra) Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
				pathGroup!.appendChild(el);
			}
			el.setAttribute('d', d);
			return el;
		}

		function createOrUpdateCircle(id: string, cx: number, cy: number, r: number, fill: string) {
			let el = document.getElementById(id) as SVGCircleElement | null;
			if (!el) {
				el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				el.id = id;
				el.setAttribute('class', styles.endpointDot);
				el.setAttribute('r', String(r));
				el.setAttribute('fill', fill);
				dotGroup!.appendChild(el);
			}
			el.setAttribute('cx', String(cx));
			el.setAttribute('cy', String(cy));
			return el;
		}

		function buildPaths() {
			frameworks.forEach(fw => {
				const card = cardRefs.current[fw.id];
				if (!card) return;
				const from = getEdgePoint(card, fw.side);
				const to = getTargetEdge(fw.side);
				const d = buildBezier(from, to, fw.side);

				createOrUpdatePath(`pathGlow-${fw.id}`, styles.bezierPathGlow, d);
				createOrUpdatePath(`path-${fw.id}`, styles.bezierPath, d);
				createOrUpdatePath(`trail-${fw.id}`, styles.activeTrail, d, { stroke: `url(#grad-${fw.id})` });
				createOrUpdateCircle(`dot-src-${fw.id}`, from.x, from.y, 3, fw.color);
				createOrUpdateCircle(`dot-tgt-${fw.id}`, to.x, to.y, 3, 'rgba(255,255,255,0.2)');
			});
		}

		function startTrails() {
			animationsRef.current.trails.forEach(t => t.kill());
			animationsRef.current.trails = [];

			frameworks.forEach(fw => {
				const trail = document.getElementById(`trail-${fw.id}`) as SVGPathElement | null;
				if (!trail) return;
				const len = trail.getTotalLength();
				const seg = len * 0.2;
				trail.style.strokeDasharray = `${seg} ${len - seg}`;
				trail.style.strokeDashoffset = String(len);

				const tw = gsap.to(trail, {
					strokeDashoffset: -len,
					duration: 4 + Math.random() * 2,
					ease: 'none',
					repeat: -1,
				});
				animationsRef.current.trails.push(tw);
			});
		}

		function startTransfers() {
			animationsRef.current.transfers.forEach(t => t.kill());
			animationsRef.current.transfers = [];

			frameworks.forEach(fw => {
				const transferEl = transferRefs.current[fw.id];
				const pathEl = `#path-${fw.id}`;
				const slotEl = slotRefs.current[fw.id];
				const cardEl = cardRefs.current[fw.id];
				if (!transferEl || !slotEl || !cardEl) return;

				const tl = gsap.timeline({ repeat: -1, repeatDelay: 3, delay: fw.delay });

				tl.set(transferEl, { opacity: 0, scale: 0.2 })
					.to(transferEl, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' })
					.to(cardEl, { borderColor: fw.color + '4D', boxShadow: `0 0 20px ${fw.color}22`, duration: 0.3, ease: 'power2.out' }, '<')
					.to(cardEl, { borderColor: 'rgba(255,255,255,0.06)', boxShadow: 'none', duration: 0.6 })
					.to(transferEl, {
						motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5], autoRotate: false },
						duration: 2.2,
						ease: 'power2.inOut',
					}, '-=0.6')
					.to(transferEl, { opacity: 0, scale: 0.4, duration: 0.3, ease: 'power2.in' }, '-=0.3')
					.call(() => {
						slotEl.classList.add(styles.slotActive);
						if (targetGlowRef.current) {
							gsap.to(targetGlowRef.current, { opacity: 1, boxShadow: `inset 0 0 40px ${fw.color}15, 0 0 30px ${fw.color}10`, duration: 0.3, ease: 'power2.out' });
							gsap.to(targetGlowRef.current, { opacity: 0, duration: 0.8, delay: 0.3, ease: 'power2.out' });
						}
					})
					.to(target, { borderColor: `${fw.color}33`, duration: 0.25, ease: 'power2.out' }, '-=0.3')
					.to(target, { borderColor: 'rgba(255,255,255,0.06)', duration: 0.8 })
					.call(() => { gsap.delayedCall(1.5, () => slotEl.classList.remove(styles.slotActive)); });

				animationsRef.current.transfers.push(tl);
			});
		}

		function startFloating() {
			animationsRef.current.floats.forEach(t => t.kill());
			animationsRef.current.floats = [];

			frameworks.forEach((fw, i) => {
				const card = cardRefs.current[fw.id];
				if (!card) return;
				const tw = gsap.to(card, {
					y: (i % 2 === 0) ? -4 : 4,
					duration: 3.5 + i * 0.4,
					ease: 'sine.inOut',
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
			tl.set(scene, { opacity: 1 })
				.from(cards, { opacity: 0, scale: 0.85, duration: 0.6, stagger: { each: 0.1, from: 'random' }, ease: 'power2.out' })
				.from(target, { opacity: 0, scale: 0.9, duration: 0.7, ease: 'power2.out' }, '-=0.3')
				.from(`#${pathGroupRef.current?.id} path, #${dotGroupRef.current?.id} circle`, { opacity: 0, duration: 0.8, stagger: 0.04, ease: 'power2.out' }, '-=0.4');
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
				animationsRef.current.trails.forEach(t => t.kill());
				animationsRef.current.transfers.forEach(t => t.kill());
				buildPaths();
				startTrails();
				startTransfers();
			}, 150);
		}

		window.addEventListener('resize', handleResize);
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
					all.forEach(t => t.resume());
				} else {
					all.forEach(t => t.pause());
				}
			},
			{ threshold: 0 },
		);
		observer.observe(scene);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', handleResize);
			animationsRef.current.trails.forEach(t => t.kill());
			animationsRef.current.transfers.forEach(t => t.kill());
			animationsRef.current.floats.forEach(t => t.kill());
		};
	}, []);

	return (
		<div className={styles.scene} ref={sceneRef}>
			<svg className={styles.curvesSvg}>
				<defs>
					{frameworks.map(fw => (
						<linearGradient key={fw.id} id={`grad-${fw.id}`}>
							<stop offset="0%" stopColor={`${fw.color}00`}/>
							<stop offset="50%" stopColor={`${fw.color}80`}/>
							<stop offset="100%" stopColor={`${fw.color}00`}/>
						</linearGradient>
					))}
				</defs>
				<g ref={pathGroupRef} id="pathGroup"/>
				<g ref={dotGroupRef} id="dotGroup"/>
			</svg>

			{frameworks.map(fw => (
				<div key={fw.id} className={`${styles.fwCard} ${fw.posClass}`} ref={el => { cardRefs.current[fw.id] = el; }}>
					<div className={styles.fwIcon}><fw.Icon /></div>
					<span className={styles.fwName}>{fw.name}</span>
				</div>
			))}

			<div className={styles.targetContainer} ref={targetRef}>
				<div className={styles.targetGlow} ref={targetGlowRef}/>
				<div className={styles.targetInner}>
					<div className={styles.targetLabel}>Islands</div>
					<div className={styles.targetSub}>Universal Renderer</div>
					<div className={styles.collectedGrid}>
						{frameworks.map(fw => (
							<div key={fw.id} className={styles.collectedSlot} ref={el => { slotRefs.current[fw.id] = el; }}>
								<fw.Icon />
							</div>
						))}
					</div>
				</div>
			</div>

			{frameworks.map(fw => {
				const fwClass = styles[`fw${fw.name}`] || '';
				return (
					<div key={fw.id} className={`${styles.transferEl} ${fwClass}`} ref={el => { transferRefs.current[fw.id] = el; }}>
						<div className={styles.transferDot}><fw.Icon /></div>
					</div>
				);
			})}

			<div className={styles.bottomHeading}>
				<div className={styles.pill}>
					<span className={styles.newTag}>v0.1</span>
					<span>Islands Architecture · Zero JS by default</span>
				</div>
				<h1 className={styles.heading}>Every framework. <span className={styles.headingEm}>One</span> architecture.</h1>
				<p className={styles.subtitle}>Ship islands of interactivity with any framework. Zero JavaScript by default.</p>
				<div className={styles.ctaRow}>
					<a href="/docs/introduction" className={`${styles.ctaButton} ${styles.ctaPrimary}`}>Get Started</a>
					<a href="https://github.com/useAvalon/Avalon" className={`${styles.ctaButton} ${styles.ctaSecondary}`} target="_blank" rel="noopener noreferrer">GitHub</a>
				</div>
			</div>
		</div>
	);
}
