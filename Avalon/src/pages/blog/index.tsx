/** @jsxImportSource preact */

export default async function BlogIndexPage() {
	const featuredPost = {
		slug: 'getting-started',
		title: 'Getting Started with Avalon',
		excerpt: 'Learn how to set up your first Avalon project with multi-framework islands architecture.',
		date: 'JANUARY 15, 2024',
	};

	const posts = [
		{
			slug: 'advanced-features',
			title: 'Advanced Features',
			excerpt: 'Explore islands architecture, selective hydration, and nested layouts.',
			date: 'JANUARY 20, 2024',
		},
		{
			slug: 'getting-started',
			title: 'Multi-Framework Support',
			excerpt: 'Use React, Vue, Svelte, Solid, and Lit in the same project.',
			date: 'JANUARY 18, 2024',
		},
		{
			slug: 'advanced-features',
			title: 'Selective Hydration',
			excerpt: 'Control when and how your components become interactive.',
			date: 'JANUARY 12, 2024',
		},
	];

	const tabs = ['All Posts', 'Tutorials', 'Updates', 'Deep Dives'];

	return (
		<div style={{ maxWidth: '1100px', margin: '0 auto' }}>
			{/* Header */}
			<h1 style={{
				fontFamily: "'DM Sans', sans-serif",
				fontSize: '48px',
				fontWeight: '700',
				color: 'rgba(255,255,255,0.95)',
				marginBottom: '40px',
			}}>
				Blog
			</h1>

			{/* Featured Post */}
			<a
				href={`/blog/${featuredPost.slug}`}
				style={{
					display: 'grid',
					gridTemplateColumns: '1.4fr 1fr',
					gap: '0',
					background: 'rgba(255,255,255,0.03)',
					borderRadius: '16px',
					overflow: 'hidden',
					textDecoration: 'none',
					marginBottom: '48px',
					border: '1px solid rgba(255,255,255,0.06)',
				}}
			>
				{/* Image placeholder */}
				<div style={{
					background: 'linear-gradient(135deg, rgba(30,30,30,1) 0%, rgba(20,20,20,1) 100%)',
					minHeight: '280px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					overflow: 'hidden',
				}}>
					{/* Decorative elements */}
					<div style={{
						display: 'flex',
						gap: '16px',
						opacity: 0.6,
					}}>
						<div style={{
							width: '60px',
							height: '80px',
							border: '2px solid rgba(255,255,255,0.3)',
							borderRadius: '8px',
						}} />
						<div style={{
							width: '60px',
							height: '80px',
							border: '2px solid rgba(255,255,255,0.3)',
							borderRadius: '8px',
							display: 'flex',
							flexDirection: 'column',
							gap: '4px',
							padding: '8px',
						}}>
							<div style={{ height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px' }} />
							<div style={{ height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', width: '70%' }} />
						</div>
					</div>
				</div>
				
				{/* Content */}
				<div style={{
					padding: '32px',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
				}}>
					<div>
						<h2 style={{
							fontSize: '24px',
							fontWeight: '600',
							color: 'rgba(255,255,255,0.95)',
							marginBottom: '12px',
							lineHeight: '1.3',
						}}>
							{featuredPost.title}
						</h2>
						<p style={{
							fontSize: '15px',
							color: 'rgba(255,255,255,0.5)',
							lineHeight: '1.6',
						}}>
							{featuredPost.excerpt}
						</p>
					</div>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						marginTop: '24px',
					}}>
						<div style={{
							width: '28px',
							height: '28px',
							borderRadius: '50%',
							background: 'linear-gradient(135deg, #159fec 50%, #2641bd 100%)',
						}} />
						<span style={{
							fontSize: '12px',
							color: 'rgba(255,255,255,0.4)',
							letterSpacing: '0.05em',
						}}>
							{featuredPost.date}
						</span>
					</div>
				</div>
			</a>

			{/* Tabs */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				marginBottom: '24px',
				borderBottom: '1px solid rgba(255,255,255,0.08)',
				paddingBottom: '16px',
			}}>
				<div style={{ display: 'flex', gap: '4px' }}>
					{tabs.map((tab, i) => (
						<button
							key={tab}
							style={{
								padding: '8px 16px',
								borderRadius: '8px',
								border: 'none',
								background: i === 0 ? 'rgba(255,255,255,0.1)' : 'transparent',
								color: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
								fontSize: '13px',
								fontWeight: '500',
								cursor: 'pointer',
							}}
						>
							{tab}
						</button>
					))}
				</div>
				<button style={{
					background: 'none',
					border: 'none',
					color: 'rgba(255,255,255,0.4)',
					fontSize: '18px',
					cursor: 'pointer',
				}}>
					⊕
				</button>
			</div>

			{/* Posts Grid */}
			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(3, 1fr)',
				gap: '16px',
			}}>
				{posts.map((post, i) => (
					<a
						key={i}
						href={`/blog/${post.slug}`}
						style={{
							display: 'flex',
							flexDirection: 'column',
							background: 'rgba(255,255,255,0.03)',
							borderRadius: '14px',
							padding: '24px',
							textDecoration: 'none',
							border: '1px solid rgba(255,255,255,0.06)',
							transition: 'background 0.15s ease',
							minHeight: '180px',
						}}
					>
						<h3 style={{
							fontSize: '17px',
							fontWeight: '600',
							color: 'rgba(255,255,255,0.95)',
							marginBottom: '8px',
							lineHeight: '1.4',
						}}>
							{post.title}
						</h3>
						<p style={{
							fontSize: '14px',
							color: 'rgba(255,255,255,0.45)',
							lineHeight: '1.5',
							flex: 1,
						}}>
							{post.excerpt}
						</p>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
							marginTop: '16px',
						}}>
							<div style={{
								width: '24px',
								height: '24px',
								borderRadius: '50%',
								background: 'linear-gradient(135deg, #159fec 50%, #2641bd 100%)',
							}} />
							<span style={{
								fontSize: '11px',
								color: 'rgba(255,255,255,0.35)',
								letterSpacing: '0.05em',
							}}>
								{post.date}
							</span>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
