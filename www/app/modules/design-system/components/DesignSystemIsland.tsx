import { useEffect, useState } from "react";
import styles from "../pages/index.module.css";
import { AnimatedCellsTab, ExtrasTab, StaticCellsTab } from "./AnimatedCells.tsx";

// ═══════════════════════════════════════════
//  AVALON DESIGN SYSTEM — Data
// ═══════════════════════════════════════════

const PALETTE = {
	core: [
		{ name: "Avalon Blue", hex: "#1F6AD3", role: "Primary — logo, CTAs, links" },
		{ name: "Avalon Deep", hex: "#0A0E1A", role: "Dark background" },
		{ name: "Avalon Black", hex: "#050510", role: "Deepest void" },
		{ name: "White", hex: "#FFFFFF", role: "Text, clean surfaces" },
	],
	accent: [
		{ name: "Horizon Cyan", hex: "#2CA1B3", role: "Secondary accent" },
		{ name: "Glow Teal", hex: "#5FB2B6", role: "Highlights, badges" },
		{ name: "Atmosphere", hex: "#0C85A4", role: "Mid accent" },
		{ name: "Midnight", hex: "#163C6D", role: "Elevated surfaces" },
	],
	neutral: [
		{ name: "Mist", hex: "#E2E8F0", role: "Light text, borders" },
		{ name: "Slate", hex: "#94A3B8", role: "Secondary text" },
		{ name: "Storm", hex: "#475569", role: "Muted, disabled" },
		{ name: "Abyss", hex: "#1E293B", role: "Cards, code blocks" },
	],
};

const LIGHT_PALETTE = {
	core: [
		{ name: "Avalon Blue", hex: "#1F6AD3", role: "Primary — same across themes" },
		{ name: "Surface", hex: "#F8FAFC", role: "Light background" },
		{ name: "White", hex: "#FFFFFF", role: "Card surfaces, page bg" },
		{ name: "Ink", hex: "#1E293B", role: "Primary text" },
	],
	accent: [
		{ name: "Horizon Cyan", hex: "#2CA1B3", role: "Secondary accent" },
		{ name: "Glow Teal", hex: "#5FB2B6", role: "Highlights, badges" },
		{ name: "Atmosphere", hex: "#0C85A4", role: "Mid accent" },
		{ name: "Midnight", hex: "#163C6D", role: "Elevated surfaces" },
	],
	neutral: [
		{ name: "Ink", hex: "#1E293B", role: "Primary text" },
		{ name: "Charcoal", hex: "#475569", role: "Secondary text" },
		{ name: "Silver", hex: "#94A3B8", role: "Muted, disabled" },
		{ name: "Cloud", hex: "#F1F5F9", role: "Cards, code blocks" },
	],
};

const GRADIENTS = [
	{
		name: "Aurora",
		css: "radial-gradient(ellipse 130% 50% at 50% 110%, #2CA1B3 0%, #1F6AD3 25%, #163C6D 45%, #0A0E1A 70%)",
		desc: "Hero glow — radial horizon",
	},
	{
		name: "Horizon",
		css: "linear-gradient(to top, #DFDFC3 0%, #5FB2B6 12%, #2CA1B3 22%, #0C85A4 32%, #163C6D 50%, #0A0E1A 75%)",
		desc: "Full atmosphere",
	},
	{
		name: "Brand Shift",
		css: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
		desc: "Buttons, pills, highlights",
	},
	{
		name: "Surface",
		css: "linear-gradient(180deg, #1E293B, #0A0E1A)",
		desc: "Cards, panels (dark)",
	},
	{
		name: "Mesh",
		css: "radial-gradient(ellipse 80% 60% at 20% 80%, rgba(31,106,211,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 20%, rgba(44,161,179,0.12) 0%, transparent 60%)",
		desc: "Dual mesh overlay",
	},
];

const LIGHT_GRADIENTS = [
	{
		name: "Sky",
		css: "linear-gradient(180deg, #FFFFFF 0%, #F0F7FF 50%, #E0EFFF 100%)",
		desc: "Soft blue tint page bg",
	},
	{
		name: "Brand Shift",
		css: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
		desc: "Same brand gradient — works on both",
	},
	{
		name: "Surface Light",
		css: "linear-gradient(180deg, #F8FAFC, #FFFFFF)",
		desc: "Subtle card elevation",
	},
	{
		name: "Mist",
		css: "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)",
		desc: "Section separator",
	},
	{
		name: "Mesh Light",
		css: "radial-gradient(ellipse 80% 60% at 20% 80%, rgba(31,106,211,0.06) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 80% 20%, rgba(44,161,179,0.05) 0%, transparent 60%)",
		desc: "Subtle mesh overlay",
	},
];

const PATTERNS = [
	{ name: "Grid", var: "--pattern-grid" },
	{ name: "Grid (fine)", var: "--pattern-grid-sm" },
	{ name: "Grid (white)", var: "--pattern-grid-white" },
	{ name: "Dots", var: "--pattern-dots" },
	{ name: "Dots (cyan)", var: "--pattern-dots-cyan" },
	{ name: "Dots (white)", var: "--pattern-dots-white" },
	{ name: "Crosshatch", var: "--pattern-crosshatch" },
	{ name: "Diamond", var: "--pattern-diamond" },
	{ name: "Diagonal", var: "--pattern-diagonal" },
	{ name: "Plus", var: "--pattern-plus" },
	{ name: "Hex", var: "--pattern-hex" },
	{ name: "Isometric", var: "--pattern-iso" },
];

const TOKENS_SPACING = [
	{ name: "--space-1", value: "0.25rem" },
	{ name: "--space-2", value: "0.5rem" },
	{ name: "--space-3", value: "0.75rem" },
	{ name: "--space-4", value: "1rem" },
	{ name: "--space-6", value: "1.5rem" },
	{ name: "--space-8", value: "2rem" },
	{ name: "--space-12", value: "3rem" },
	{ name: "--space-16", value: "4rem" },
	{ name: "--space-24", value: "6rem" },
];

const TOKENS_RADIUS = [
	{ name: "--radius-sm", value: "6px" },
	{ name: "--radius-md", value: "10px" },
	{ name: "--radius-lg", value: "16px" },
	{ name: "--radius-xl", value: "24px" },
	{ name: "--radius-pill", value: "9999px" },
];

const TOKENS_TYPE = [
	{ name: "--text-display", value: "4rem" },
	{ name: "--text-h1", value: "2.5rem" },
	{ name: "--text-h2", value: "1.75rem" },
	{ name: "--text-h3", value: "1.25rem" },
	{ name: "--text-body", value: "0.9375rem" },
	{ name: "--text-small", value: "0.8125rem" },
	{ name: "--text-caption", value: "0.75rem" },
];

const CONTRAST_DARK = [
	{ bg: "#050510", fg: "#FFFFFF", label: "White / Black" },
	{ bg: "#050510", fg: "#1F6AD3", label: "Blue / Black" },
	{ bg: "#0A0E1A", fg: "#5FB2B6", label: "Teal / Deep" },
	{ bg: "#1E293B", fg: "#E2E8F0", label: "Mist / Abyss" },
	{ bg: "#1F6AD3", fg: "#FFFFFF", label: "White / Blue" },
];

const CONTRAST_LIGHT = [
	{ bg: "#FFFFFF", fg: "#1E293B", label: "Ink / White" },
	{ bg: "#FFFFFF", fg: "#1F6AD3", label: "Blue / White" },
	{ bg: "#F1F5F9", fg: "#475569", label: "Charcoal / Cloud" },
	{ bg: "#F8FAFC", fg: "#0C85A4", label: "Atmosphere / Surface" },
	{ bg: "#1F6AD3", fg: "#FFFFFF", label: "White / Blue" },
];

const CSS_DARK = `:root {
  --avalon-blue: #1F6AD3;
  --avalon-deep: #0A0E1A;
  --avalon-black: #050510;
  --avalon-white: #FFFFFF;
  --avalon-cyan: #2CA1B3;
  --avalon-teal: #5FB2B6;
  --avalon-atmosphere: #0C85A4;
  --avalon-midnight: #163C6D;
  --avalon-mist: #E2E8F0;
  --avalon-slate: #94A3B8;
  --avalon-storm: #475569;
  --avalon-abyss: #1E293B;
  --surface-1: rgba(255,255,255,0.02);
  --surface-2: rgba(255,255,255,0.04);
  --surface-border: rgba(255,255,255,0.06);
  --surface-border-hover: rgba(255,255,255,0.12);
}`;

const CSS_LIGHT = `[data-theme="light"] {
  --avalon-deep: #F8FAFC;
  --avalon-black: #FFFFFF;
  --avalon-mist: #1E293B;
  --avalon-slate: #475569;
  --avalon-storm: #94A3B8;
  --avalon-abyss: #F1F5F9;
  --surface-1: rgba(0,0,0,0.02);
  --surface-2: rgba(0,0,0,0.04);
  --surface-border: rgba(0,0,0,0.08);
  --surface-border-hover: rgba(0,0,0,0.15);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
}`;

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

function copy(t: string) {
	navigator.clipboard.writeText(t).catch(() => {});
}

function isLight(h: string) {
	const r = parseInt(h.slice(1, 3), 16);
	const g = parseInt(h.slice(3, 5), 16);
	const b = parseInt(h.slice(5, 7), 16);
	return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// ═══════════════════════════════════════════
//  Tabs
// ═══════════════════════════════════════════

const TABS = [
	{ id: "palette", label: "Palette" },
	{ id: "gradients", label: "Gradients" },
	{ id: "patterns", label: "Patterns" },
	{ id: "staticcells", label: "Static Cells" },
	{ id: "cells", label: "Animated Cells" },
	{ id: "extras", label: "Particles & FX" },
	{ id: "tokens", label: "Tokens" },
	{ id: "components", label: "Components" },
	{ id: "css", label: "CSS Export" },
];

// ═══════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════

function Swatch({
	color,
	theme,
}: {
	color: { name: string; hex: string; role?: string };
	theme: string;
}) {
	const [copied, setCopied] = useState(false);
	return (
		<div
			class={styles.swatch}
			onClick={() => {
				copy(color.hex);
				setCopied(true);
				setTimeout(() => setCopied(false), 800);
			}}
		>
			<div
				class={styles.swatchColor}
				style={{
					background: color.hex,
					border:
						color.hex === "#FFFFFF"
							? `1px solid ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`
							: undefined,
				}}
			>
				{copied && (
					<span
						style={{
							fontSize: 9,
							fontWeight: 600,
							letterSpacing: 1.5,
							textTransform: "uppercase" as const,
							color: isLight(color.hex) ? "#0A0E1A" : "#fff",
						}}
					>
						Copied
					</span>
				)}
			</div>
			<span class={styles.swatchName}>{color.name}</span>
			<span class={styles.swatchHex}>{color.hex}</span>
			{color.role && <span class={styles.swatchRole}>{color.role}</span>}
		</div>
	);
}

function PaletteTab({ theme }: { theme: string }) {
	const palette = theme === "dark" ? PALETTE : LIGHT_PALETTE;
	const contrasts = theme === "dark" ? CONTRAST_DARK : CONTRAST_LIGHT;
	const groups: [string, typeof PALETTE.core][] = [
		["Core", palette.core],
		["Accent", palette.accent],
		["Neutral", palette.neutral],
	];

	return (
		<div>
			{groups.map(([label, colors]) => (
				<div key={label}>
					<div class={styles.label}>{label}</div>
					<div class={styles.swatchGrid}>
						{colors.map((c) => (
							<Swatch key={c.hex + c.name} color={c} theme={theme} />
						))}
					</div>
				</div>
			))}
			<div class={styles.label}>Contrast Pairings</div>
			<div class={styles.contrastGrid}>
				{contrasts.map((p, i) => (
					<div
						key={i}
						class={styles.contrastPair}
						style={{
							background: p.bg,
							color: p.fg,
							border:
								p.bg === "#FFFFFF"
									? "1px solid #E2E8F0"
									: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)"}`,
						}}
					>
						{p.label}
					</div>
				))}
			</div>
		</div>
	);
}

function GradientsTab({ theme }: { theme: string }) {
	const grads = theme === "dark" ? GRADIENTS : LIGHT_GRADIENTS;
	return (
		<div>
			{grads.map((g) => (
				<div key={g.name} class={styles.gradCard} onClick={() => copy(g.css)}>
					<div
						class={styles.gradPreview}
						style={{
							background: g.css.includes("transparent")
								? `${g.css}, ${theme === "dark" ? "#0A0E1A" : "#FFFFFF"}`
								: g.css,
						}}
					/>
					<div class={styles.gradInfo}>
						<div class={styles.gradName}>{g.name}</div>
						<div class={styles.gradDesc}>{g.desc}</div>
						<div class={styles.gradCode}>{g.css}</div>
					</div>
				</div>
			))}
		</div>
	);
}

function PatternsTab({ theme }: { theme: string }) {
	return (
		<div>
			<p class={styles.desc}>
				SVG patterns available as CSS custom properties. Layer over gradients or solid backgrounds
				for texture.
				{theme === "light" && " Light theme uses slightly higher opacity for visibility on white."}
			</p>
			{PATTERNS.map((p) => (
				<div
					key={p.name}
					class={theme === "dark" ? styles.patternFullDark : styles.patternFullLight}
				>
					<div
						style={{
							position: "absolute",
							inset: 0,
							backgroundImage: `var(${p.var})`,
							backgroundRepeat: "repeat",
						}}
					/>
					<div class={styles.patternLabel}>{p.name}</div>
				</div>
			))}
		</div>
	);
}

function TokensTab() {
	return (
		<div>
			<div class={styles.label}>Typography</div>
			<table class={styles.tokenTable}>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
						<th>Sample</th>
					</tr>
				</thead>
				<tbody>
					{TOKENS_TYPE.map((t) => (
						<tr key={t.name}>
							<td class={styles.tokenName}>{t.name}</td>
							<td class={styles.tokenValue}>{t.value}</td>
							<td style={{ fontSize: t.value, lineHeight: 1.2 }}>Aa</td>
						</tr>
					))}
				</tbody>
			</table>

			<div class={styles.label}>Spacing</div>
			<table class={styles.tokenTable}>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
						<th>Visual</th>
					</tr>
				</thead>
				<tbody>
					{TOKENS_SPACING.map((t) => (
						<tr key={t.name}>
							<td class={styles.tokenName}>{t.name}</td>
							<td class={styles.tokenValue}>{t.value}</td>
							<td>
								<div
									style={{
										width: t.value,
										height: 8,
										background: "var(--avalon-blue)",
										borderRadius: 2,
										opacity: 0.5,
										maxWidth: 200,
									}}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<div class={styles.label}>Border Radius</div>
			<table class={styles.tokenTable}>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
						<th>Visual</th>
					</tr>
				</thead>
				<tbody>
					{TOKENS_RADIUS.map((t) => (
						<tr key={t.name}>
							<td class={styles.tokenName}>{t.name}</td>
							<td class={styles.tokenValue}>{t.value}</td>
							<td>
								<div
									style={{
										width: 32,
										height: 32,
										border: "2px solid var(--avalon-blue)",
										borderRadius: t.value,
										opacity: 0.5,
									}}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ComponentsTab({ theme }: { theme: string }) {
	const isDark = theme === "dark";
	return (
		<div class={styles.showcase}>
			<p class={styles.desc}>
				Live component previews using the design tokens. Toggle theme above to see both modes.
			</p>

			{/* Buttons */}
			<div class={styles.showcaseCard}>
				<div class={styles.showcasePreview}>
					<button
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "10px 20px",
							background: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
							color: "#fff",
							border: "none",
							borderRadius: 10,
							fontSize: 14,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "var(--font-sans)",
						}}
					>
						Primary
					</button>
					<button
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "10px 20px",
							background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
							color: isDark ? "#E2E8F0" : "#1E293B",
							border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
							borderRadius: 10,
							fontSize: 14,
							fontWeight: 500,
							cursor: "pointer",
							fontFamily: "var(--font-sans)",
						}}
					>
						Secondary
					</button>
					<button
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "10px 20px",
							background: "transparent",
							color: isDark ? "#94A3B8" : "#475569",
							border: "none",
							borderRadius: 10,
							fontSize: 14,
							fontWeight: 500,
							cursor: "pointer",
							fontFamily: "var(--font-sans)",
						}}
					>
						Ghost
					</button>
				</div>
				<div class={styles.showcaseInfo}>
					<h3 class={styles.showcaseTitle}>Buttons</h3>
					<p class={styles.showcaseDesc}>
						Primary uses brand gradient. Secondary and ghost adapt to theme.
					</p>
				</div>
			</div>

			{/* Badges */}
			<div class={styles.showcaseCard}>
				<div class={styles.showcasePreview}>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
							border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
							borderRadius: 9999,
							padding: "4px 12px",
							fontSize: 12,
							color: isDark ? "#94A3B8" : "#475569",
							fontFamily: "var(--font-sans)",
							fontWeight: 500,
						}}
					>
						Pill Badge
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							background: "rgba(31,106,211,0.15)",
							border: "1px solid rgba(31,106,211,0.3)",
							borderRadius: 6,
							padding: "2px 8px",
							fontSize: 12,
							color: "#1F6AD3",
							fontFamily: "var(--font-sans)",
							fontWeight: 600,
						}}
					>
						Badge
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							background: "rgba(44,161,179,0.15)",
							border: "1px solid rgba(44,161,179,0.3)",
							borderRadius: 6,
							padding: "2px 8px",
							fontSize: 12,
							color: "#2CA1B3",
							fontFamily: "var(--font-sans)",
							fontWeight: 600,
						}}
					>
						Cyan
					</span>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							background: "rgba(95,178,182,0.15)",
							border: "1px solid rgba(95,178,182,0.3)",
							borderRadius: 6,
							padding: "2px 8px",
							fontSize: 12,
							color: "#5FB2B6",
							fontFamily: "var(--font-sans)",
							fontWeight: 600,
						}}
					>
						Teal
					</span>
				</div>
				<div class={styles.showcaseInfo}>
					<h3 class={styles.showcaseTitle}>Badges & Pills</h3>
					<p class={styles.showcaseDesc}>
						Pill uses surface tokens. Colored badges use brand colors at 15% opacity.
					</p>
				</div>
			</div>

			{/* Cards */}
			<div class={styles.showcaseCard}>
				<div
					class={styles.showcasePreview}
					style={{ flexDirection: "column", gap: 12, alignItems: "stretch" }}
				>
					<div
						style={{
							background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
							border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
							borderRadius: 16,
							padding: 20,
						}}
					>
						<div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Card Title</div>
						<div style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#475569", lineHeight: 1.5 }}>
							Cards use surface-1 background with surface-border. Hover state shifts to surface-2
							with surface-border-hover.
						</div>
					</div>
					<div
						style={{
							background: isDark
								? "linear-gradient(180deg, #1E293B, #0A0E1A)"
								: "linear-gradient(180deg, #F8FAFC, #FFFFFF)",
							border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,
							borderRadius: 16,
							padding: 20,
						}}
					>
						<div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Gradient Card</div>
						<div style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#475569", lineHeight: 1.5 }}>
							Uses the surface gradient for subtle depth. Works well for elevated content.
						</div>
					</div>
				</div>
				<div class={styles.showcaseInfo}>
					<h3 class={styles.showcaseTitle}>Cards</h3>
					<p class={styles.showcaseDesc}>
						Flat and gradient variants. Both adapt to theme via surface tokens.
					</p>
				</div>
			</div>

			{/* Code block */}
			<div class={styles.showcaseCard}>
				<div
					class={styles.showcasePreview}
					style={{ flexDirection: "column", alignItems: "stretch" }}
				>
					<div
						style={{
							background: isDark ? "#1E293B" : "#F1F5F9",
							borderRadius: 10,
							padding: 16,
							fontFamily: "'JetBrains Mono', monospace",
							fontSize: 12,
							lineHeight: 1.7,
							color: isDark ? "#94A3B8" : "#475569",
						}}
					>
						<div style={{ color: isDark ? "#475569" : "#94A3B8", marginBottom: 4 }}>
							{"// island hydration"}
						</div>
						<div>
							<span style={{ color: "#1F6AD3" }}>{"<Counter "}</span>
							<span style={{ color: "#2CA1B3" }}>island</span>
							<span style={{ color: isDark ? "#E2E8F0" : "#1E293B" }}>{"={{ "}</span>
							<span style={{ color: "#2CA1B3" }}>condition</span>
							<span style={{ color: isDark ? "#E2E8F0" : "#1E293B" }}>{": "}</span>
							<span style={{ color: "#5FB2B6" }}>{'"on:visible"'}</span>
							<span style={{ color: isDark ? "#E2E8F0" : "#1E293B" }}>{" }}"}</span>
							<span style={{ color: "#1F6AD3" }}>{" />"}</span>
						</div>
					</div>
				</div>
				<div class={styles.showcaseInfo}>
					<h3 class={styles.showcaseTitle}>Code Blocks</h3>
					<p class={styles.showcaseDesc}>
						Abyss background in dark, Cloud in light. Mono font with brand-colored syntax.
					</p>
				</div>
			</div>
		</div>
	);
}

function CSSExportTab({ theme }: { theme: string }) {
	const [copied, setCopied] = useState(false);
	const code = theme === "dark" ? CSS_DARK : `${CSS_DARK}\n\n${CSS_LIGHT}`;
	return (
		<div>
			<p class={styles.desc}>
				{theme === "dark"
					? "Dark theme CSS custom properties. Click to copy."
					: 'Full dark + light theme CSS custom properties. Apply light theme with data-theme="light" on any ancestor element.'}
			</p>
			<div
				class={styles.codeBlock}
				onClick={() => {
					copy(code);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				}}
			>
				<div class={styles.codeBlockHeader}>
					<span class={styles.codeBlockTitle}>
						CSS Custom Properties{theme === "light" ? " (Dark + Light)" : ""}
					</span>
					<span class={styles.codeBlockHint} style={{ color: copied ? "#5FB2B6" : undefined }}>
						{copied ? "Copied!" : "Click to copy"}
					</span>
				</div>
				<pre class={styles.codeBlockPre}>{code}</pre>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════

export default function DesignSystemIsland() {
	const [tab, setTab] = useState("palette");

	// Read global theme from <html data-theme> (set by ThemeToggle in nav)
	const [theme, setTheme] = useState<"dark" | "light">(() => {
		if (typeof document === "undefined") return "dark";
		return (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
	});

	// Watch for external theme changes (from nav ThemeToggle)
	useEffect(() => {
		const observer = new MutationObserver(() => {
			const current = document.documentElement.getAttribute("data-theme") as
				| "dark"
				| "light"
				| null;
			if (current && current !== theme) setTheme(current);
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		return () => observer.disconnect();
	}, [theme]);

	// When the inline toggle is used, update the global theme
	const switchTheme = (t: "dark" | "light") => {
		setTheme(t);
		document.documentElement.setAttribute("data-theme", t);
		localStorage.setItem("avalon-theme", t);
	};

	return (
		<div class={styles.root}>
			<div class={styles.mx}>
				{/* Header */}
				<div class={styles.hdr}>
					<div class={styles.mark} />
					<h1 class={styles.title}>
						Avalon <span class={styles.titleMuted}>Design System</span>
					</h1>
				</div>
				<p class={styles.subtitle}>
					Palette, gradients, patterns, tokens, and components — dark &amp; light.
				</p>

				{/* Theme toggle */}
				<div class={styles.themeRow}>
					<button
						class={theme === "dark" ? styles.themeBtnActive : styles.themeBtn}
						onClick={() => switchTheme("dark")}
					>
						● Dark
					</button>
					<button
						class={theme === "light" ? styles.themeBtnActive : styles.themeBtn}
						onClick={() => switchTheme("light")}
					>
						○ Light
					</button>
				</div>

				{/* Tabs */}
				<div class={styles.tabs}>
					{TABS.map((t) => (
						<button
							key={t.id}
							class={tab === t.id ? styles.tabActive : styles.tab}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				{/* Tab content */}
				{tab === "palette" && <PaletteTab theme={theme} />}
				{tab === "gradients" && <GradientsTab theme={theme} />}
				{tab === "patterns" && <PatternsTab theme={theme} />}
				{tab === "staticcells" && (
					<StaticCellsTab
						chipClass={styles.chip}
						chipActiveClass={styles.chipActive}
						stageClass={styles.stage}
						stageCClass={styles.stageContent}
						stageIClass={styles.stageInfo}
						stageTClass={styles.stageTitle}
						stageDClass={styles.stageDesc}
					/>
				)}
				{tab === "cells" && (
					<AnimatedCellsTab
						chipClass={styles.chip}
						chipActiveClass={styles.chipActive}
						stageClass={styles.stage}
						stageCClass={styles.stageContent}
						stageIClass={styles.stageInfo}
						stageTClass={styles.stageTitle}
						stageDClass={styles.stageDesc}
					/>
				)}
				{tab === "extras" && (
					<ExtrasTab
						stageClass={styles.stage}
						stageCClass={styles.stageContent}
						stageIClass={styles.stageInfo}
						stageTClass={styles.stageTitle}
						stageDClass={styles.stageDesc}
					/>
				)}
				{tab === "tokens" && <TokensTab />}
				{tab === "components" && <ComponentsTab theme={theme} />}
				{tab === "css" && <CSSExportTab theme={theme} />}

				{/* Footer */}
				<div class={styles.foot}>
					Avalon Design System — palette · gradients · patterns · static cells · animated cells ·
					particles · tokens · components · dark &amp; light
				</div>
			</div>
		</div>
	);
}
