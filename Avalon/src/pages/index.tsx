import LandingHero from '../islands/LandingHero.tsx';

export default async function HomePage() {
	return (
		<div style={{ margin: '-40px -24px' }}>
			<LandingHero island={{ condition: 'on:client' }} />
			
			{/* Features Section */}
			<section style={{
				padding: '120px 24px',
				maxWidth: '1200px',
				margin: '0 auto',
			}}>
				<div style={{ textAlign: 'center', marginBottom: '64px' }}>
					<div style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						background: 'rgba(255,255,255,0.04)',
						border: '1px solid rgba(255,255,255,0.07)',
						borderRadius: '100px',
						padding: '6px 14px',
						marginBottom: '16px',
						fontSize: '12px',
						color: 'rgba(255,255,255,0.5)',
					}}>
						Why Avalon
					</div>
					<h2 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '36px',
						fontWeight: '400',
						color: 'rgba(255,255,255,0.9)',
						letterSpacing: '-0.02em',
						marginBottom: '12px',
					}}>
						Built for the modern web
					</h2>
					<p style={{
						fontSize: '15px',
						color: 'rgba(255,255,255,0.4)',
						maxWidth: '500px',
						margin: '0 auto',
						lineHeight: '1.6',
					}}>
						A framework that doesn't force you to choose. Use the best tool for each component.
					</p>
				</div>

				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(3, 1fr)',
					gap: '16px',
				}}>
					<FeatureCard
						icon="🏝️"
						title="Islands Architecture"
						description="Only interactive components ship JavaScript. Static content stays static."
					/>
					<FeatureCard
						icon="⚡"
						title="Selective Hydration"
						description="Control when components hydrate: on load, on visible, on interaction, or on idle."
					/>
					<FeatureCard
						icon="🎨"
						title="Multi-Framework"
						description="React, Preact, Vue, Svelte, Solid, and Lit. All in the same project."
					/>
					<FeatureCard
						icon="📁"
						title="File-System Routing"
						description="Routes are automatically generated from your file structure. No config needed."
					/>
					<FeatureCard
						icon="🔄"
						title="Nested Layouts"
						description="Compose layouts hierarchically. Each section can have its own wrapper."
					/>
					<FeatureCard
						icon="🚀"
						title="Edge Ready"
						description="Deploy anywhere. Nitro powers the server with adapters for every platform."
					/>
				</div>
			</section>

			{/* Code Example Section */}
			<section style={{
				padding: '80px 24px',
				background: 'linear-gradient(180deg, rgba(103,58,184,0.03) 0%, rgba(66,184,131,0.03) 100%)',
				borderTop: '1px solid rgba(255,255,255,0.04)',
				borderBottom: '1px solid rgba(255,255,255,0.04)',
			}}>
				<div style={{ maxWidth: '1000px', margin: '0 auto' }}>
					<div style={{ textAlign: 'center', marginBottom: '48px' }}>
						<h2 style={{
							fontFamily: "'Instrument Serif', serif",
							fontSize: '32px',
							fontWeight: '400',
							color: 'rgba(255,255,255,0.9)',
							letterSpacing: '-0.02em',
							marginBottom: '12px',
						}}>
							Simple by design
						</h2>
						<p style={{
							fontSize: '15px',
							color: 'rgba(255,255,255,0.4)',
							lineHeight: '1.6',
						}}>
							Import your component, add the island prop. That's it.
						</p>
					</div>

					<div style={{
						background: 'linear-gradient(135deg, rgba(103,58,184,0.08) 0%, rgba(50,79,255,0.06) 50%, rgba(66,184,131,0.08) 100%)',
						border: '1px solid rgba(255,255,255,0.08)',
						borderRadius: '16px',
						overflow: 'hidden',
						boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
					}}>
						<div style={{
							padding: '12px 16px',
							borderBottom: '1px solid rgba(255,255,255,0.06)',
							background: 'rgba(0,0,0,0.2)',
							display: 'flex',
							gap: '8px',
						}}>
							<div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f57' }} />
							<div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#febc2e' }} />
							<div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28c840' }} />
						</div>
						<pre style={{
							padding: '28px',
							margin: 0,
							fontSize: '14px',
							lineHeight: '1.8',
							overflow: 'auto',
							fontFamily: "'SF Mono', 'Fira Code', monospace",
						}}>
							<code>
								<span style={{ color: '#c792ea' }}>import</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> ReactCounter </span><span style={{ color: '#c792ea' }}>from</span><span style={{ color: '#c3e88d' }}> '../islands/ReactCounter.tsx'</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>;</span>{'\n'}
								<span style={{ color: '#c792ea' }}>import</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> VueCounter </span><span style={{ color: '#c792ea' }}>from</span><span style={{ color: '#c3e88d' }}> '../islands/VueCounter.vue'</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>;</span>{'\n'}
								<span style={{ color: '#c792ea' }}>import</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> SvelteCounter </span><span style={{ color: '#c792ea' }}>from</span><span style={{ color: '#c3e88d' }}> '../islands/SvelteCounter.svelte'</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>;</span>{'\n'}
								{'\n'}
								<span style={{ color: '#c792ea' }}>export default async function</span><span style={{ color: '#82aaff' }}> Page</span><span style={{ color: 'rgba(255,255,255,0.7)' }}>() {'{'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>  </span><span style={{ color: '#c792ea' }}>return</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> (</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>    </span><span style={{ color: '#89ddff' }}>{'<'}</span><span style={{ color: '#f07178' }}>div</span><span style={{ color: '#89ddff' }}>{'>'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.4)' }}>      {'{'}</span><span style={{ color: '#546e7a' }}>/* Hydrates immediately */</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{'}'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>      </span><span style={{ color: '#89ddff' }}>{'<'}</span><span style={{ color: '#ffcb6b' }}>ReactCounter</span><span style={{ color: '#c792ea' }}> island</span><span style={{ color: '#89ddff' }}>=</span><span style={{ color: 'rgba(255,255,255,0.7)' }}>{'{'}'{'{'}</span><span style={{ color: '#c792ea' }}> condition</span><span style={{ color: '#89ddff' }}>:</span><span style={{ color: '#c3e88d' }}> 'on:client'</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> {'}'}{'}'}</span><span style={{ color: '#89ddff' }}> /{'>'}</span>{'\n'}
								{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.4)' }}>      {'{'}</span><span style={{ color: '#546e7a' }}>/* Hydrates when visible */</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{'}'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>      </span><span style={{ color: '#89ddff' }}>{'<'}</span><span style={{ color: '#ffcb6b' }}>VueCounter</span><span style={{ color: '#c792ea' }}> island</span><span style={{ color: '#89ddff' }}>=</span><span style={{ color: 'rgba(255,255,255,0.7)' }}>{'{'}'{'{'}</span><span style={{ color: '#c792ea' }}> condition</span><span style={{ color: '#89ddff' }}>:</span><span style={{ color: '#c3e88d' }}> 'on:visible'</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> {'}'}{'}'}</span><span style={{ color: '#89ddff' }}> /{'>'}</span>{'\n'}
								{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.4)' }}>      {'{'}</span><span style={{ color: '#546e7a' }}>/* Hydrates on interaction */</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{'}'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>      </span><span style={{ color: '#89ddff' }}>{'<'}</span><span style={{ color: '#ffcb6b' }}>SvelteCounter</span><span style={{ color: '#c792ea' }}> island</span><span style={{ color: '#89ddff' }}>=</span><span style={{ color: 'rgba(255,255,255,0.7)' }}>{'{'}'{'{'}</span><span style={{ color: '#c792ea' }}> condition</span><span style={{ color: '#89ddff' }}>:</span><span style={{ color: '#c3e88d' }}> 'on:interaction'</span><span style={{ color: 'rgba(255,255,255,0.7)' }}> {'}'}{'}'}</span><span style={{ color: '#89ddff' }}> /{'>'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>    </span><span style={{ color: '#89ddff' }}>{'</'}</span><span style={{ color: '#f07178' }}>div</span><span style={{ color: '#89ddff' }}>{'>'}</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>  );</span>{'\n'}
								<span style={{ color: 'rgba(255,255,255,0.7)' }}>{'}'}</span>
							</code>
						</pre>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section style={{
				padding: '120px 24px',
				textAlign: 'center',
			}}>
				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '42px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '16px',
				}}>
					Ready to build?
				</h2>
				<p style={{
					fontSize: '16px',
					color: 'rgba(255,255,255,0.4)',
					marginBottom: '32px',
					lineHeight: '1.6',
				}}>
					Start with the framework you know. Add others as you need them.
				</p>
				<div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
					<a href="/frameworks" style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '14px 28px',
						background: 'rgba(255,255,255,0.9)',
						color: '#0a0a0a',
						borderRadius: '10px',
						fontSize: '15px',
						fontWeight: '500',
						textDecoration: 'none',
					}}>
						View Demo
					</a>
					<a href="https://github.com" style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '14px 28px',
						background: 'rgba(255,255,255,0.06)',
						color: 'rgba(255,255,255,0.8)',
						border: '1px solid rgba(255,255,255,0.08)',
						borderRadius: '10px',
						fontSize: '15px',
						fontWeight: '500',
						textDecoration: 'none',
					}}>
						GitHub
					</a>
				</div>
			</section>

			{/* Footer */}
			<footer style={{
				padding: '60px 24px 0',
				borderTop: '1px solid rgba(255,255,255,0.06)',
				position: 'relative',
				overflow: 'hidden',
			}}>
				<div style={{
					maxWidth: '1200px',
					margin: '0 auto',
					position: 'relative',
					zIndex: 1,
				}}>
					{/* Top section with logo and links */}
					<div style={{
						display: 'grid',
						gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
						gap: '48px',
						marginBottom: '48px',
					}}>
						<div>
							<div style={{
								fontFamily: "'Instrument Serif', serif",
								fontSize: '24px',
								fontStyle: 'italic',
								color: 'rgba(255,255,255,0.9)',
								marginBottom: '12px',
							}}>
								Avalon
							</div>
							<p style={{
								fontSize: '14px',
								color: 'rgba(255,255,255,0.4)',
								lineHeight: '1.6',
								maxWidth: '280px',
							}}>
								Multi-framework islands architecture for the modern web.
							</p>
						</div>

						<div>
							<h4 style={{
								fontSize: '11px',
								color: '#159fec',
								textTransform: 'uppercase',
								letterSpacing: '0.1em',
								marginBottom: '16px',
								fontWeight: '600',
							}}>
								Product
							</h4>
							<nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
								<a href="/frameworks" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Frameworks</a>
								<a href="/islands" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Islands</a>
								<a href="/layouts" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Layouts</a>
								<a href="/api-demo" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>API Routes</a>
							</nav>
						</div>

						<div>
							<h4 style={{
								fontSize: '11px',
								color: '#159fec',
								textTransform: 'uppercase',
								letterSpacing: '0.1em',
								marginBottom: '16px',
								fontWeight: '600',
							}}>
								Resources
							</h4>
							<nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
								<a href="/blog" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Blog</a>
								<a href="/blog/getting-started" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Getting Started</a>
								<a href="/blog/advanced-features" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Advanced</a>
							</nav>
						</div>

						<div>
							<h4 style={{
								fontSize: '11px',
								color: '#159fec',
								textTransform: 'uppercase',
								letterSpacing: '0.1em',
								marginBottom: '16px',
								fontWeight: '600',
							}}>
								Connect
							</h4>
							<nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
								<a href="https://github.com" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>GitHub</a>
								<a href="https://twitter.com" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Twitter</a>
								<a href="https://discord.com" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>Discord</a>
							</nav>
						</div>
					</div>

					{/* Bottom bar */}
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						padding: '20px 0',
						borderTop: '1px solid rgba(255,255,255,0.06)',
						position: 'relative',
						zIndex: 2,
					}}>
						<div style={{ display: 'flex', gap: '24px' }}>
							<a href="/terms" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline', fontSize: '13px' }}>Terms of Service</a>
							<a href="/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline', fontSize: '13px' }}>Privacy Policy</a>
						</div>
						<p style={{
							fontSize: '13px',
							color: 'rgba(255,255,255,0.3)',
						}}>
							Avalon © 2026
						</p>
					</div>
				</div>

				{/* Large outline text underneath */}
				<div style={{
					position: 'relative',
					width: '100%',
					height: 'clamp(100px, 18vw, 200px)',
					marginTop: '-20px',
					overflow: 'hidden',
				}}>
					<svg
						viewBox="0 0 800 120"
						preserveAspectRatio="xMidYMid meet"
						style={{
							width: '100%',
							height: '100%',
							position: 'absolute',
							left: '50%',
							transform: 'translateX(-50%)',
						}}
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
		<div style={{
			background: 'rgba(255,255,255,0.02)',
			border: '1px solid rgba(255,255,255,0.06)',
			borderRadius: '16px',
			padding: '28px',
			transition: 'all 0.3s ease',
		}}>
			<div style={{ fontSize: '28px', marginBottom: '16px' }}>{icon}</div>
			<h3 style={{
				fontFamily: "'Instrument Serif', serif",
				fontSize: '18px',
				color: 'rgba(255,255,255,0.9)',
				marginBottom: '8px',
			}}>
				{title}
			</h3>
			<p style={{
				fontSize: '14px',
				color: 'rgba(255,255,255,0.45)',
				lineHeight: '1.6',
			}}>
				{description}
			</p>
		</div>
	);
}
