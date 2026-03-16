/** @jsxImportSource preact */
import { useEffect, useRef } from 'preact/hooks';
import { gsap } from 'gsap';
import styles from './FooterBrand.module.css';

export default function FooterBrand() {
	const elRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const el = elRef.current;
		if (!el) return;
		const parent = el.closest('[data-brand-wrap]') || el.parentElement;
		if (!parent) return;

		function onMove(e: Event) {
			const me = e as MouseEvent;
			const rect = el!.getBoundingClientRect();
			const x = ((me.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
			const y = ((me.clientY - rect.top) / rect.height * 100).toFixed(1) + '%';
			el!.style.setProperty('--mouse-x', x);
			el!.style.setProperty('--mouse-y', y);
		}

		function onLeave() {
			gsap.to(el, {
				'--mouse-x': '-100%',
				'--mouse-y': '-100%',
				duration: 0.4,
				ease: 'power2.out',
				onUpdate() {
					const mx = gsap.getProperty(el, '--mouse-x');
					const my = gsap.getProperty(el, '--mouse-y');
					el!.style.setProperty('--mouse-x', String(mx));
					el!.style.setProperty('--mouse-y', String(my));
				},
			});
		}

		parent.addEventListener('mousemove', onMove);
		parent.addEventListener('mouseleave', onLeave);

		return () => {
			parent.removeEventListener('mousemove', onMove);
			parent.removeEventListener('mouseleave', onLeave);
		};
	}, []);

	return (
		<span className={styles.brand} ref={elRef}>
			Avalon
		</span>
	);
}
