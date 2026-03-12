import LandingHero from '../components/LandingHero.tsx';
import styles from './index.module.css';
import btnStyles from '@shared/styles/buttons.module.css';
import cardStyles from '@shared/styles/cards.module.css';
import codeStyles from '@shared/styles/code.module.css';
import badgeStyles from '@shared/styles/badges.module.css';

export const metadata = {
	title: 'Avalon — Islands Architecture for the Modern Web',
	description: 'Avalon is a multi-framework islands architecture. Ship interactive components with React, Preact, Vue, Svelte, Solid, or Lit. Zero JS by default. Edge-ready.',
	ogTitle: 'Avalon — Islands Architecture for the Modern Web',
	ogDescription: 'Multi-framework islands architecture. Zero JS by default. Edge-ready.',
	ogImage: '/og-image.png',
};

export default async function HomePage() {
	return (
		<>
			{/* Hero */}
			<section className={styles.hero}>
				<div className={styles.heroAurora} />
				<div className={styles.heroGlow} />
				<div className={styles.heroIsland}>
					<LandingHero island={{ condition: 'on:client' }} />
				</div>
			</section>

			{/* Why Avalon */}
			<WhyAvalonSection cardStyles={cardStyles} styles={styles} />

			{/* Frameworks */}
			<FrameworksSection styles={styles} badgeStyles={badgeStyles} />

			{/* Code Snippet */}
			<CodeSnippetSection styles={styles} codeStyles={codeStyles} />

			{/* How It Works */}
			<HowItWorksSection styles={styles} />

			{/* CTA */}
			<CTASection styles={styles} btnStyles={btnStyles} />

			{/* Footer */}
			<Footer styles={styles} />
		</>
	);
}


function WhyAvalonSection({ cardStyles, styles }: { cardStyles: Record<string, string>; styles: Record<string, string> }) {
	const features = [
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13.6V8.4C3 7.07 3 6.4 3.27 5.89a2.5 2.5 0 0 1 1.1-1.1C4.87 4.5 5.57 4.5 6.9 4.5h.6c.93 0 1.4 0 1.81.14a2.5 2.5 0 0 1 .94.63c.28.31.44.74.76 1.6l.18.53h4.91c1.33 0 2 0 2.51.27a2.5 2.5 0 0 1 1.1 1.1c.27.5.27 1.17.27 2.5v2.33c0 1.33 0 2-.27 2.51a2.5 2.5 0 0 1-1.1 1.1c-.5.27-1.18.27-2.51.27H7.9c-1.33 0-2 0-2.51-.27a2.5 2.5 0 0 1-1.1-1.1C4 15.6 3.67 15 3 13.6Z"/><circle cx="17" cy="11" r="1.5" fill="currentColor" stroke="none" opacity="0.4"/></svg>, title: 'Islands Architecture', desc: 'Only interactive components ship JavaScript. Static content stays static — zero overhead.' },
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, title: 'Selective Hydration', desc: 'Control when components hydrate: on load, on visible, on interaction, or on idle.' },
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>, title: 'Multi-Framework', desc: 'React, Preact, Vue, Svelte, Solid, and Lit. All in the same project, side by side.' },
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, title: 'File-System Routing', desc: 'Routes are automatically generated from your file structure. No config needed.' },
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, title: 'Edge Deployment', desc: 'Deploy anywhere. Nitro powers the server with adapters for every platform.' },
		{ icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/><circle cx="12" cy="12" r="10"/></svg>, title: 'Zero JS by Default', desc: 'Pages ship no JavaScript unless you explicitly add an island. Fast by default.' },
	];
	return (
		<section className={styles.section}>
			<div className={styles.sectionInner}>
				<div className={styles.sectionHeader}>
					<p className={styles.sectionLabel}>Why Avalon</p>
					<h2 className={styles.sectionTitle}>Built for the modern web</h2>
					<p className={styles.sectionSubtitle}>A framework that doesn't force you to choose. Use the best tool for each component.</p>
				</div>
				<div className={styles.featureGrid}>
					{features.map(f => (
						<div key={f.title} className={`${cardStyles.card} ${styles.featureCard}`}>
							<div className={styles.featureIcon}>{f.icon}</div>
							<h3 className={styles.featureTitle}>{f.title}</h3>
							<p className={styles.featureDesc}>{f.desc}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}


function FrameworksSection({ styles, badgeStyles }: { styles: Record<string, string>; badgeStyles: Record<string, string> }) {
	const frameworks = [
		{ name: 'React', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="#61DAFB"><circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1" transform="rotate(120 12 12)"/></svg> },
		{ name: 'Preact', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="none"><circle cx="12" cy="12" r="2" fill="#673AB8"/><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(90 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="#673AB8" strokeWidth="1" transform="rotate(150 12 12)"/></svg> },
		{ name: 'Vue', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="none"><path d="M2 3h4l6 10L18 3h4L12 22z" fill="#42B883"/><path d="M6 3h3.5L12 8l2.5-5H18L12 15z" fill="#35495E"/></svg> },
		{ name: 'Svelte', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="#FF3E00"><path d="M19.1 3.5C17.1 1 13.5.5 11 2L5.7 5.5C4.5 6.3 3.7 7.5 3.4 8.8c-.2 1.1-.1 2.3.4 3.3-.3.5-.5 1-.6 1.6-.3 1.3-.1 2.7.5 3.9 2 2.5 5.6 3 8.1 1.5l5.3-3.5c1.2-.8 2-2 2.3-3.3.2-1.1.1-2.3-.4-3.3.3-.5.5-1 .6-1.6.3-1.3.1-2.7-.5-3.9z"/></svg> },
		{ name: 'Solid', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="none"><path d="M4 6l8-4 8 4v4l-8 4-8-4V6z" fill="#4F88C6" opacity="0.6"/><path d="M4 10l8 4 8-4v4l-8 4-8-4v-4z" fill="#4F88C6" opacity="0.8"/><path d="M4 14l8 4 8-4v4l-8 4-8-4v-4z" fill="#4F88C6"/></svg> },
		{ name: 'Lit', svg: <svg viewBox="0 0 24 24" width="40" height="40" fill="none"><path d="M12 2L6 8l6 4-6 4 6 6 6-6-6-4 6-4z" fill="#324FFF"/><path d="M12 2l6 6-6 4-6-4z" fill="#324FFF" opacity="0.6"/></svg> },
	];
	return (
		<section className={styles.section}>
			<div className={styles.sectionInner}>
				<div className={styles.sectionHeader}>
					<span className={badgeStyles.pill}>Supported Frameworks</span>
					<h2 className={styles.sectionTitle}>Use any framework</h2>
					<p className={styles.sectionSubtitle}>Mix and match frameworks in the same project. Each island is bundled independently.</p>
				</div>
				<div className={styles.frameworksRow}>
					{frameworks.map(fw => (
						<div key={fw.name} className={styles.frameworkItem}>
							{fw.svg}
							<span className={styles.frameworkName}>{fw.name}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}


function CodeSnippetSection({ styles, codeStyles }: { styles: Record<string, string>; codeStyles: Record<string, string> }) {
	return (
		<section className={styles.section}>
			<div className={styles.sectionInner}>
				<div className={styles.codeLayout}>
					<div className={styles.codeText}>
						<p className={styles.sectionLabel}>Simple by design</p>
						<h2 className={styles.sectionTitle}>One prop. Any framework.</h2>
						<p className={styles.sectionSubtitle}>Import your component, add the <code className={styles.inlineCode}>island</code> prop. Control hydration with a single string.</p>
					</div>
					<div className={`${codeStyles.codeBlock} ${styles.codeBlockWide}`}>
						<div className={codeStyles.codeHeader}>
							<span className={styles.dot} style={{ background: 'rgba(255,255,255,0.12)' }} />
							<span className={styles.dot} style={{ background: 'rgba(255,255,255,0.12)' }} />
							<span className={styles.dot} style={{ background: 'rgba(255,255,255,0.12)' }} />
							<span className={styles.codeFilename}>src/pages/demo.tsx</span>
						</div>
						<pre className={codeStyles.codePre}><code className="hljs"><span className="hljs-keyword">import</span> <span className="hljs-title class_">Counter</span> <span className="hljs-keyword">from</span> <span className="hljs-string">'../islands/Counter.tsx'</span>;{'\n'}<span className="hljs-keyword">import</span> <span className="hljs-title class_">Chart</span> <span className="hljs-keyword">from</span> <span className="hljs-string">'../islands/Chart.vue'</span>;{'\n'}<span className="hljs-keyword">import</span> <span className="hljs-title class_">Feed</span> <span className="hljs-keyword">from</span> <span className="hljs-string">'../islands/Feed.svelte'</span>;{'\n'}{'\n'}<span className="hljs-keyword">export</span> <span className="hljs-keyword">default</span> <span className="hljs-keyword">async</span> <span className="hljs-keyword">function</span> <span className="hljs-title function_">Page</span>() {'{'}{'\n'}{'  '}<span className="hljs-keyword">return</span> ({'\n'}{'    '}&lt;div&gt;{'\n'}{'      '}<span className="hljs-comment">{'{/* Hydrates immediately */}'}</span>{'\n'}{'      '}&lt;<span className="hljs-title class_">Counter</span> island={'{{ '}condition: <span className="hljs-string">'on:client'</span>{' }}'} /&gt;{'\n'}{'\n'}{'      '}<span className="hljs-comment">{'{/* Hydrates when scrolled into view */}'}</span>{'\n'}{'      '}&lt;<span className="hljs-title class_">Chart</span> island={'{{ '}condition: <span className="hljs-string">'on:visible'</span>{' }}'} /&gt;{'\n'}{'\n'}{'      '}<span className="hljs-comment">{'{/* Hydrates on first interaction */}'}</span>{'\n'}{'      '}&lt;<span className="hljs-title class_">Feed</span> island={'{{ '}condition: <span className="hljs-string">'on:interaction'</span>{' }}'} /&gt;{'\n'}{'    '}&lt;/div&gt;{'\n'}{'  '});{'\n'}{'}'}</code></pre>
					</div>
				</div>
			</div>
		</section>
	);
}

function HowItWorksSection({ styles }: { styles: Record<string, string> }) {
	const steps = [
		{ num: '01', title: 'Zero JS by default', desc: 'Every page ships as pure HTML and CSS. No JavaScript is sent to the browser unless you explicitly add an island.' },
		{ num: '02', title: 'Selective hydration', desc: 'Mark components as islands with a single prop. Choose when they hydrate — on load, on scroll, on click, or on idle.' },
		{ num: '03', title: 'Edge-ready', desc: 'Powered by Nitro, Avalon deploys to any platform — Node, Deno, Bun, Cloudflare Workers, Vercel, and more.' },
	];
	return (
		<section className={styles.section}>
			<div className={styles.sectionInner}>
				<div className={styles.sectionHeader}>
					<p className={styles.sectionLabel}>How it works</p>
					<h2 className={styles.sectionTitle}>Performance by design</h2>
				</div>
				<div className={styles.stepsGrid}>
					{steps.map(s => (
						<div key={s.num} className={styles.step}>
							<div className={styles.stepNum}>{s.num}</div>
							<h3 className={styles.stepTitle}>{s.title}</h3>
							<p className={styles.stepDesc}>{s.desc}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}


function CTASection({ styles, btnStyles }: { styles: Record<string, string>; btnStyles: Record<string, string> }) {
	return (
		<section className={styles.ctaZone}>
			<h2 className={styles.ctaTitle}>Ready to build?</h2>
			<p className={styles.ctaSubtitle}>Start with the framework you know. Add others as you need them.</p>
			<div className={styles.ctaButtons}>
				<a href="/docs/introduction" className={btnStyles.btnPrimary}>Get Started</a>
				<a href="https://github.com/useAvalon/Avalon" className={btnStyles.btnSecondary} target="_blank" rel="noopener noreferrer">GitHub</a>
			</div>
		</section>
	);
}

function Footer({ styles }: { styles: Record<string, string> }) {
	return (
		<>
			{/* Arc horizon */}
			<div className={styles.arcHorizon} aria-hidden="true">
				<div className={styles.arcHaze} />
				<div className={styles.arcEllipse} />
				<div className={styles.arcBloom} />
			</div>

			{/* Light footer zone */}
			<footer className={styles.footerZone}>
				<div className={styles.brandFloat} aria-hidden="true">
					<span className={styles.footerBrandText} data-footer-brand>Avalon</span>
				</div>
				<div className={styles.footerInner}>
					<div className={styles.footerGrid}>
						<div>
							<div className={styles.footerLogo}>
								<img src="/logo.svg" alt="" className={styles.footerLogoImg} />
								Avalon
							</div>
							<p className={styles.footerTagline}>Multi-framework islands architecture for the modern web.</p>
						</div>
						<div>
							<h4 className={styles.footerHeading}>Docs</h4>
							<nav className={styles.footerNav} aria-label="Docs navigation">
								<a href="/docs/introduction" className={styles.footerLink}>Introduction</a>
								<a href="/docs/installation" className={styles.footerLink}>Installation</a>
								<a href="/docs/quick-start" className={styles.footerLink}>Quick Start</a>
								<a href="/docs/islands-architecture" className={styles.footerLink}>Islands</a>
							</nav>
						</div>
						<div>
							<h4 className={styles.footerHeading}>Community</h4>
							<nav className={styles.footerNav} aria-label="Community navigation">
								<a href="https://github.com/useAvalon/Avalon" className={styles.footerLink} target="_blank" rel="noopener noreferrer">GitHub</a>
								<a href="https://discord.gg/avalon" className={styles.footerLink} target="_blank" rel="noopener noreferrer">Discord</a>
							</nav>
						</div>
						<div>
							<h4 className={styles.footerHeading}>Resources</h4>
							<nav className={styles.footerNav} aria-label="Resources navigation">
								<a href="/blog" className={styles.footerLink}>Blog</a>
								<a href="/blog/getting-started" className={styles.footerLink}>Getting Started</a>
								<a href="/blog/advanced-features" className={styles.footerLink}>Advanced Features</a>
							</nav>
						</div>
					</div>
					<div className={styles.footerBottom}>
						<p className={styles.footerCopyright}>Avalon © 2026</p>
					</div>
				</div>
			</footer>
		</>
	);
}
