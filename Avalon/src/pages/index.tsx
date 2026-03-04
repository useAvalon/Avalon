import LandingHero from '../islands/LandingHero.tsx';
import styles from './index.module.css';

export default async function HomePage() {
	return (
		<div className={styles.landing}>
			<LandingHero island={{ condition: 'on:client' }} />
			
			{/* Features Section */}
			<section className={styles.features}>
				<div className={styles.sectionHeader}>
					<div className={styles.pill}>Why Avalon</div>
					<h2 className={styles.sectionTitle}>Built for the modern web</h2>
					<p className={styles.sectionSubtitle}>
						A framework that doesn't force you to choose. Use the best tool for each component.
					</p>
				</div>

				<div className={styles.featureGrid}>
					<FeatureCard icon="🏝️" title="Islands Architecture" description="Only interactive components ship JavaScript. Static content stays static." />
					<FeatureCard icon="⚡" title="Selective Hydration" description="Control when components hydrate: on load, on visible, on interaction, or on idle." />
					<FeatureCard icon="🎨" title="Multi-Framework" description="React, Preact, Vue, Svelte, Solid, and Lit. All in the same project." />
					<FeatureCard icon="📁" title="File-System Routing" description="Routes are automatically generated from your file structure. No config needed." />
					<FeatureCard icon="🔄" title="Nested Layouts" description="Compose layouts hierarchically. Each section can have its own wrapper." />
					<FeatureCard icon="🚀" title="Edge Ready" description="Deploy anywhere. Nitro powers the server with adapters for every platform." />
				</div>
			</section>

			{/* Code Example Section */}
			<section className={styles.codeSection}>
				<div className={styles.codeSectionInner}>
					<div className={styles.codeSectionHeader}>
						<h2 className={styles.codeSectionTitle}>Simple by design</h2>
						<p className={styles.codeSectionSubtitle}>
							Import your component, add the island prop. That's it.
						</p>
					</div>

					<div className={styles.codeBlock}>
						<div className={styles.codeBlockHeader}>
							<div className={`${styles.dot} ${styles.dotRed}`} />
							<div className={`${styles.dot} ${styles.dotYellow}`} />
							<div className={`${styles.dot} ${styles.dotGreen}`} />
						</div>
						<pre className={styles.codeBlockPre}>
							<code>
								<span className={styles.synKeyword}>import</span><span className={styles.synText}> ReactCounter </span><span className={styles.synKeyword}>from</span><span className={styles.synString}> '../islands/ReactCounter.tsx'</span><span className={styles.synPunctuation}>;</span>{'\n'}
								<span className={styles.synKeyword}>import</span><span className={styles.synText}> VueCounter </span><span className={styles.synKeyword}>from</span><span className={styles.synString}> '../islands/VueCounter.vue'</span><span className={styles.synPunctuation}>;</span>{'\n'}
								<span className={styles.synKeyword}>import</span><span className={styles.synText}> SvelteCounter </span><span className={styles.synKeyword}>from</span><span className={styles.synString}> '../islands/SvelteCounter.svelte'</span><span className={styles.synPunctuation}>;</span>{'\n'}
								{'\n'}
								<span className={styles.synKeyword}>export default async function</span><span className={styles.synFunction}> Page</span><span className={styles.synText}>() {'{'}</span>{'\n'}
								<span className={styles.synText}>  </span><span className={styles.synKeyword}>return</span><span className={styles.synText}> (</span>{'\n'}
								<span className={styles.synText}>    </span><span className={styles.synTag}>{'<'}</span><span className={styles.synElement}>div</span><span className={styles.synTag}>{'>'}</span>{'\n'}
								<span className={styles.synPunctuation}>      {'{'}</span><span className={styles.synComment}>/* Hydrates immediately */</span><span className={styles.synPunctuation}>{'}'}</span>{'\n'}
								<span className={styles.synText}>      </span><span className={styles.synTag}>{'<'}</span><span className={styles.synComponent}>ReactCounter</span><span className={styles.synProp}> island</span><span className={styles.synTag}>=</span><span className={styles.synText}>{'{'}'{'{'}</span><span className={styles.synProp}> condition</span><span className={styles.synTag}>:</span><span className={styles.synString}> 'on:client'</span><span className={styles.synText}> {'}'}{'}'}</span><span className={styles.synTag}> /{'>'}</span>{'\n'}
								{'\n'}
								<span className={styles.synPunctuation}>      {'{'}</span><span className={styles.synComment}>/* Hydrates when visible */</span><span className={styles.synPunctuation}>{'}'}</span>{'\n'}
								<span className={styles.synText}>      </span><span className={styles.synTag}>{'<'}</span><span className={styles.synComponent}>VueCounter</span><span className={styles.synProp}> island</span><span className={styles.synTag}>=</span><span className={styles.synText}>{'{'}'{'{'}</span><span className={styles.synProp}> condition</span><span className={styles.synTag}>:</span><span className={styles.synString}> 'on:visible'</span><span className={styles.synText}> {'}'}{'}'}</span><span className={styles.synTag}> /{'>'}</span>{'\n'}
								{'\n'}
								<span className={styles.synPunctuation}>      {'{'}</span><span className={styles.synComment}>/* Hydrates on interaction */</span><span className={styles.synPunctuation}>{'}'}</span>{'\n'}
								<span className={styles.synText}>      </span><span className={styles.synTag}>{'<'}</span><span className={styles.synComponent}>SvelteCounter</span><span className={styles.synProp}> island</span><span className={styles.synTag}>=</span><span className={styles.synText}>{'{'}'{'{'}</span><span className={styles.synProp}> condition</span><span className={styles.synTag}>:</span><span className={styles.synString}> 'on:interaction'</span><span className={styles.synText}> {'}'}{'}'}</span><span className={styles.synTag}> /{'>'}</span>{'\n'}
								<span className={styles.synText}>    </span><span className={styles.synTag}>{'</'}</span><span className={styles.synElement}>div</span><span className={styles.synTag}>{'>'}</span>{'\n'}
								<span className={styles.synText}>  );</span>{'\n'}
								<span className={styles.synText}>{'}'}</span>
							</code>
						</pre>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className={styles.cta}>
				<h2 className={styles.ctaTitle}>Ready to build?</h2>
				<p className={styles.ctaSubtitle}>
					Start with the framework you know. Add others as you need them.
				</p>
				<div className={styles.ctaButtons}>
					<a href="/frameworks" className={styles.btnPrimary}>View Demo</a>
					<a href="https://github.com" className={styles.btnSecondary}>GitHub</a>
				</div>
			</section>

			{/* Footer */}
			<footer className={styles.footer}>
				<div className={styles.footerInner}>
					<div className={styles.footerGrid}>
						<div>
							<div className={styles.footerLogo}>Avalon</div>
							<p className={styles.footerTagline}>
								Multi-framework islands architecture for the modern web.
							</p>
						</div>

						<div>
							<h4 className={styles.footerHeading}>Product</h4>
							<nav className={styles.footerNav}>
								<a href="/frameworks" className={styles.footerLink}>Frameworks</a>
								<a href="/islands" className={styles.footerLink}>Islands</a>
								<a href="/layouts" className={styles.footerLink}>Layouts</a>
								<a href="/api-demo" className={styles.footerLink}>API Routes</a>
							</nav>
						</div>

						<div>
							<h4 className={styles.footerHeading}>Resources</h4>
							<nav className={styles.footerNav}>
								<a href="/blog" className={styles.footerLink}>Blog</a>
								<a href="/blog/getting-started" className={styles.footerLink}>Getting Started</a>
								<a href="/blog/advanced-features" className={styles.footerLink}>Advanced</a>
							</nav>
						</div>

						<div>
							<h4 className={styles.footerHeading}>Connect</h4>
							<nav className={styles.footerNav}>
								<a href="https://github.com" className={styles.footerLink}>GitHub</a>
								<a href="https://twitter.com" className={styles.footerLink}>Twitter</a>
								<a href="https://discord.com" className={styles.footerLink}>Discord</a>
							</nav>
						</div>
					</div>

					<div className={styles.footerBottom}>
						<div className={styles.footerBottomLinks}>
							<a href="/terms" className={styles.footerBottomLink}>Terms of Service</a>
							<a href="/privacy" className={styles.footerBottomLink}>Privacy Policy</a>
						</div>
						<p className={styles.footerCopyright}>Avalon © 2026</p>
					</div>
				</div>

				<div className={styles.footerBrand}>
					<svg
						viewBox="0 0 800 120"
						preserveAspectRatio="xMidYMid meet"
						className={styles.footerBrandSvg}
					>
						<defs>
							<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
								<feGaussianBlur stdDeviation="2" result="coloredBlur"/>
								<feMerge>
									<feMergeNode in="coloredBlur"/>
									<feMergeNode in="SourceGraphic"/>
								</feMerge>
							</filter>
						</defs>
						<text
							x="50%"
							y="85%"
							textAnchor="middle"
							style={{
								fontFamily: "'Instrument Serif', serif",
								fontSize: '140px',
								fontWeight: '400',
								fill: 'none',
								stroke: '#159fec',
								strokeWidth: '1.5',
								filter: 'url(#glow)',
								opacity: 0.6,
							}}
						>
							Avalon
						</text>
					</svg>
				</div>
			</footer>
		</div>
	);
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
	return (
		<div className={styles.featureCard}>
			<div className={styles.featureIcon}>{icon}</div>
			<h3 className={styles.featureTitle}>{title}</h3>
			<p className={styles.featureDesc}>{description}</p>
		</div>
	);
}
