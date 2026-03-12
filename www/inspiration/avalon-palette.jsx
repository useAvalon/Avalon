import { useState } from "react";

const PALETTE = {
  core: [
    { name: "Avalon Blue", hex: "#1F6AD3", role: "Primary brand color — logo, CTAs, links" },
    { name: "Avalon Deep", hex: "#0F0F35", role: "Dark background, hero sections" },
    { name: "Avalon Black", hex: "#050510", role: "Deepest background, space/void" },
    { name: "White", hex: "#FFFFFF", role: "Text on dark, clean backgrounds" },
  ],
  accent: [
    { name: "Horizon Cyan", hex: "#2CA1B3", role: "Accents, hover states, secondary actions" },
    { name: "Glow Teal", hex: "#5FB2B6", role: "Highlights, badges, success states" },
    { name: "Atmosphere", hex: "#0C85A4", role: "Mid-tone accent, links on dark" },
    { name: "Midnight Navy", hex: "#163C6D", role: "Card backgrounds, elevated surfaces" },
  ],
  neutral: [
    { name: "Mist", hex: "#E2E8F0", role: "Light text, borders, dividers" },
    { name: "Slate", hex: "#94A3B8", role: "Secondary text, captions" },
    { name: "Storm", hex: "#475569", role: "Muted text, disabled states" },
    { name: "Abyss", hex: "#1E293B", role: "Card bg (light on dark), code blocks" },
  ],
};

const GRADIENTS = [
  {
    name: "Horizon",
    css: "linear-gradient(to top, #716349, #DFDFC3, #83C0BB, #2CA1B3, #0C85A4, #12638E, #163C6D, #0F0F35, #050510)",
    desc: "The hero gradient — earth's horizon glow rising into deep space",
  },
  {
    name: "Horizon (simplified)",
    css: "linear-gradient(to top, #DFDFC3 0%, #5FB2B6 15%, #2CA1B3 25%, #0C85A4 35%, #163C6D 55%, #0F0F35 75%, #050510 100%)",
    desc: "Cleaner version for production use",
  },
  {
    name: "Aurora",
    css: "radial-gradient(ellipse 120% 40% at 50% 100%, #2CA1B3 0%, #1F6AD3 30%, #163C6D 55%, #0F0F35 75%, #050510 100%)",
    desc: "Radial horizon glow — perfect for hero backgrounds",
  },
  {
    name: "Brand Shift",
    css: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
    desc: "Primary to accent — buttons, badges, highlights",
  },
  {
    name: "Deep Surface",
    css: "linear-gradient(180deg, #1E293B, #0F0F35)",
    desc: "Subtle dark gradient for cards and panels",
  },
  {
    name: "Glow Ring",
    css: "radial-gradient(ellipse 100% 35% at 50% 105%, rgba(31,106,211,0.4) 0%, rgba(44,161,179,0.15) 40%, transparent 70%)",
    desc: "Soft bottom glow overlay — add on top of dark backgrounds",
  },
];

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function Swatch({ color, size = "normal" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div
      onClick={handleCopy}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: size === "normal" ? 140 : 120,
        flex: "1 1 140px",
      }}
    >
      <div
        style={{
          width: "100%",
          height: size === "normal" ? 64 : 48,
          borderRadius: 10,
          background: color.hex,
          border: color.hex === "#FFFFFF" ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: `0 2px 12px ${color.hex}33`,
          transition: "transform 0.2s, box-shadow 0.2s",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 6px 24px ${color.hex}55`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `0 2px 12px ${color.hex}33`;
        }}
      >
        {copied && (
          <span style={{ fontSize: 11, color: isLight(color.hex) ? "#0F0F35" : "#fff", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            Copied
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", lineHeight: 1.3 }}>
          {color.name}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
          {color.hex}
        </div>
        {color.role && (
          <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4, marginTop: 2 }}>
            {color.role}
          </div>
        )}
      </div>
    </div>
  );
}

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function GradientCard({ gradient }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(gradient.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      onClick={handleCopy}
      style={{
        cursor: "pointer",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0a1a",
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div
        style={{
          width: "100%",
          height: gradient.name.includes("Ring") ? 140 : 120,
          background: gradient.name.includes("Ring")
            ? `${gradient.css}, linear-gradient(180deg, #050510, #0F0F35)`
            : gradient.css,
          position: "relative",
        }}
      >
        {copied && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            fontSize: 12, fontWeight: 600, color: "#fff", letterSpacing: 1, textTransform: "uppercase",
          }}>
            CSS Copied
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{gradient.name}</div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, lineHeight: 1.4 }}>{gradient.desc}</div>
        <div style={{
          fontSize: 10, color: "#475569", fontFamily: "monospace", marginTop: 8,
          background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "6px 8px",
          wordBreak: "break-all", lineHeight: 1.5,
        }}>
          {gradient.css}
        </div>
      </div>
    </div>
  );
}

function CSSVariablesBlock() {
  const [copied, setCopied] = useState(false);
  const vars = `:root {
  /* Core */
  --avalon-blue: #1F6AD3;
  --avalon-deep: #0F0F35;
  --avalon-black: #050510;
  --avalon-white: #FFFFFF;

  /* Accent */
  --avalon-cyan: #2CA1B3;
  --avalon-teal: #5FB2B6;
  --avalon-atmosphere: #0C85A4;
  --avalon-midnight: #163C6D;

  /* Neutral */
  --avalon-mist: #E2E8F0;
  --avalon-slate: #94A3B8;
  --avalon-storm: #475569;
  --avalon-abyss: #1E293B;

  /* Gradients */
  --avalon-gradient-horizon: linear-gradient(to top, #DFDFC3 0%, #5FB2B6 15%, #2CA1B3 25%, #0C85A4 35%, #163C6D 55%, #0F0F35 75%, #050510 100%);
  --avalon-gradient-aurora: radial-gradient(ellipse 120% 40% at 50% 100%, #2CA1B3 0%, #1F6AD3 30%, #163C6D 55%, #0F0F35 75%, #050510 100%);
  --avalon-gradient-brand: linear-gradient(135deg, #1F6AD3, #2CA1B3);
  --avalon-gradient-surface: linear-gradient(180deg, #1E293B, #0F0F35);
  --avalon-gradient-glow: radial-gradient(ellipse 100% 35% at 50% 105%, rgba(31,106,211,0.4) 0%, rgba(44,161,179,0.15) 40%, transparent 70%);
}`;
  const handleCopy = () => {
    copyToClipboard(vars);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      onClick={handleCopy}
      style={{
        cursor: "pointer",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "16px 20px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>CSS Variables</span>
        <span style={{ fontSize: 11, color: copied ? "#5FB2B6" : "#475569", transition: "color 0.3s" }}>
          {copied ? "Copied!" : "Click to copy"}
        </span>
      </div>
      <pre style={{
        fontSize: 11, lineHeight: 1.7, color: "#94A3B8", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
        {vars}
      </pre>
    </div>
  );
}

function HeroDemo() {
  return (
    <div style={{
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      height: 320,
      position: "relative",
      background: "#050510",
    }}>
      {/* Aurora radial glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 120% 50% at 50% 110%, #2CA1B3 0%, #1F6AD3 20%, #163C6D 40%, #0F0F35 65%, #050510 100%)",
      }} />
      {/* Warm core glow */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "50%", height: "30%",
        background: "radial-gradient(ellipse at 50% 100%, rgba(223,223,195,0.25) 0%, rgba(95,178,182,0.1) 40%, transparent 70%)",
      }} />
      {/* Content */}
      <div style={{
        position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: 32,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#5FB2B6",
          marginBottom: 12, fontWeight: 500,
        }}>
          Islands Architecture for the Modern Web
        </div>
        <div style={{
          fontSize: 42, fontWeight: 700, color: "#FFFFFF",
          letterSpacing: -1, lineHeight: 1.1,
          fontFamily: "'Outfit', sans-serif",
        }}>
          Avalon
        </div>
        <p style={{
          fontSize: 15, color: "#94A3B8", maxWidth: 400, lineHeight: 1.6, margin: "16px 0 24px",
        }}>
          Ship interactive islands with Preact. Zero JS by default. Blazing fast hydration.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{
            background: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 24px", fontSize: 14, fontWeight: 600,
            cursor: "pointer",
          }}>
            Get Started
          </button>
          <button style={{
            background: "rgba(255,255,255,0.06)",
            color: "#E2E8F0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            padding: "10px 24px", fontSize: 14, fontWeight: 500,
            cursor: "pointer",
          }}>
            Documentation
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvalonPalette() {
  const [tab, setTab] = useState("palette");
  const tabs = [
    { id: "palette", label: "Palette" },
    { id: "gradients", label: "Gradients" },
    { id: "demo", label: "Hero Demo" },
    { id: "code", label: "CSS Vars" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050510",
      color: "#E2E8F0",
      fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      padding: "32px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: "linear-gradient(135deg, #1F6AD3, #2CA1B3)",
            }} />
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
              Avalon <span style={{ color: "#475569", fontWeight: 400 }}>Color System</span>
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, marginTop: 4 }}>
            Brand palette, gradients, and usage guidelines
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 32,
          background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "8px 16px", fontSize: 13, fontWeight: 500,
                border: "none", borderRadius: 7, cursor: "pointer",
                transition: "all 0.2s",
                background: tab === t.id ? "rgba(31,106,211,0.15)" : "transparent",
                color: tab === t.id ? "#1F6AD3" : "#64748B",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Palette Tab */}
        {tab === "palette" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {Object.entries(PALETTE).map(([group, colors]) => (
              <div key={group}>
                <h3 style={{
                  fontSize: 12, textTransform: "uppercase", letterSpacing: 2,
                  color: "#475569", fontWeight: 600, margin: "0 0 16px",
                }}>
                  {group === "core" ? "Core" : group === "accent" ? "Accent" : "Neutral"}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {colors.map((c) => (
                    <Swatch key={c.hex} color={c} />
                  ))}
                </div>
              </div>
            ))}

            {/* Contrast examples */}
            <div>
              <h3 style={{
                fontSize: 12, textTransform: "uppercase", letterSpacing: 2,
                color: "#475569", fontWeight: 600, margin: "0 0 16px",
              }}>
                Usage Examples
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {[
                  { bg: "#050510", fg: "#FFFFFF", label: "White on Black" },
                  { bg: "#050510", fg: "#1F6AD3", label: "Blue on Black" },
                  { bg: "#0F0F35", fg: "#5FB2B6", label: "Teal on Deep" },
                  { bg: "#1E293B", fg: "#E2E8F0", label: "Mist on Abyss" },
                  { bg: "#1F6AD3", fg: "#FFFFFF", label: "White on Blue" },
                  { bg: "#FFFFFF", fg: "#0F0F35", label: "Deep on White" },
                ].map((ex, i) => (
                  <div key={i} style={{
                    background: ex.bg, color: ex.fg, padding: "12px 18px",
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: ex.bg === "#FFFFFF" ? "1px solid #E2E8F0" : "1px solid rgba(255,255,255,0.06)",
                    flex: "1 1 160px", textAlign: "center",
                  }}>
                    {ex.label}
                    <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 4, fontFamily: "monospace" }}>
                      {ex.fg} / {ex.bg}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gradients Tab */}
        {tab === "gradients" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))",
            gap: 16,
          }}>
            {GRADIENTS.map((g) => (
              <GradientCard key={g.name} gradient={g} />
            ))}
          </div>
        )}

        {/* Hero Demo Tab */}
        {tab === "demo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              Hero section using the Aurora gradient with warm-core overlay
            </p>
            <HeroDemo />
          </div>
        )}

        {/* CSS Vars Tab */}
        {tab === "code" && <CSSVariablesBlock />}

        {/* Footer tip */}
        <div style={{
          marginTop: 40, padding: "16px 0",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: 12, color: "#334155", textAlign: "center",
        }}>
          Click any swatch or gradient to copy its value
        </div>
      </div>
    </div>
  );
}
