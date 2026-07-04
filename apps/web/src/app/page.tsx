import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --navy: #070c1a;
          --navy-2: #0d1528;
          --navy-3: #131e36;
          --gold: #f5a623;
          --gold-light: #fbbf24;
          --gold-dim: rgba(245,166,35,0.12);
          --gold-border: rgba(245,166,35,0.25);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--navy);
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f0;
          overflow-x: hidden;
        }

        .display { font-family: 'Syne', sans-serif; }

        /* Sun glow */
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 0.80; transform: scale(1.08); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sun-core {
          animation: pulse-glow 4s ease-in-out infinite;
        }
        .sun-rays {
          animation: spin-slow 24s linear infinite;
        }
        .hero-tag   { animation: fade-up .55s ease both; animation-delay: .05s; }
        .hero-h1    { animation: fade-up .6s ease both;  animation-delay: .15s; }
        .hero-sub   { animation: fade-up .6s ease both;  animation-delay: .28s; }
        .hero-ctas  { animation: fade-up .6s ease both;  animation-delay: .40s; }
        .stats-row  { animation: fade-up .65s ease both; animation-delay: .55s; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--gold); color: #07100f;
          font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
          padding: 14px 32px; border-radius: 10px; text-decoration: none;
          transition: transform .15s, box-shadow .15s, background .15s;
          box-shadow: 0 0 28px rgba(245,166,35,0.35);
        }
        .btn-primary:hover {
          background: var(--gold-light);
          transform: translateY(-2px);
          box-shadow: 0 0 44px rgba(245,166,35,0.55);
        }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: #94a3b8;
          font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 15px;
          padding: 14px 32px; border-radius: 10px; text-decoration: none;
          border: 1px solid rgba(148,163,184,0.2);
          transition: color .15s, border-color .15s, transform .15s;
        }
        .btn-ghost:hover { color: #e2e8f0; border-color: rgba(148,163,184,0.45); transform: translateY(-2px); }

        .stat-card {
          background: var(--navy-2);
          border: 1px solid var(--gold-border);
          border-radius: 16px; padding: 24px 28px;
          transition: transform .2s, box-shadow .2s;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(245,166,35,0.12); }

        .step-card {
          position: relative;
          background: var(--navy-2);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px; padding: 32px;
          transition: transform .2s, border-color .2s;
        }
        .step-card:hover { transform: translateY(-4px); border-color: var(--gold-border); }

        .audience-chip {
          display: flex; align-items: center; gap: 10px;
          background: var(--navy-3);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 100px; padding: 10px 20px 10px 14px;
          font-size: 14px; color: #cbd5e1;
          transition: border-color .18s, color .18s;
        }
        .audience-chip:hover { border-color: var(--gold-border); color: #f5a623; }

        .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); }

        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 48px;
          background: linear-gradient(to bottom, rgba(7,12,26,0.95), transparent);
          backdrop-filter: blur(8px);
        }

        .logo-mark {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800;
          color: white; text-decoration: none;
        }
        .logo-sun {
          width: 28px; height: 28px; border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, #fbbf24, #f59e0b);
          box-shadow: 0 0 16px rgba(245,166,35,0.6);
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          nav { padding: 16px 24px; }
          .hero-section { padding: 120px 24px 80px; }
          .hero-h1-text { font-size: clamp(36px, 10vw, 72px) !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .chips-wrap { flex-direction: column !important; }
        }
      `}</style>

      {/* Nav */}
      <nav>
        <a href="/" className="logo-mark">
          <div className="logo-sun" />
          SolarCredit
        </a>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/sign-in" className="btn-ghost" style={{ padding: "10px 22px", fontSize: 14 }}>Sign In</a>
          <a href="/sign-up" className="btn-primary" style={{ padding: "10px 22px", fontSize: 14 }}>Apply Now →</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-section" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 48px 80px", overflow: "hidden" }}>

        {/* Background sun glow */}
        <div style={{ position: "absolute", top: "50%", right: "-80px", transform: "translateY(-55%)", width: 700, height: 700, pointerEvents: "none", zIndex: 0 }}>
          {/* Outer glow */}
          <div className="sun-core" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.18) 0%, rgba(245,166,35,0.05) 50%, transparent 75%)" }} />
          {/* Rays */}
          <svg className="sun-rays" viewBox="0 0 700 700" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.2 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x1 = 350 + Math.cos(angle) * 160;
              const y1 = 350 + Math.sin(angle) * 160;
              const x2 = 350 + Math.cos(angle) * 340;
              const y2 = 350 + Math.sin(angle) * 340;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round" />;
            })}
          </svg>
          {/* Core */}
          <div className="sun-core" style={{ position: "absolute", top: "50%", left: "50%", width: 140, height: 140, marginLeft: -70, marginTop: -70, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #fbbf24, #f59e0b, #d97706)", boxShadow: "0 0 80px rgba(245,166,35,0.5), 0 0 160px rgba(245,166,35,0.2)" }} />
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1, width: "100%" }}>
          <div style={{ maxWidth: 680 }}>
            <div className="hero-tag" style={{ marginBottom: 28 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--gold-dim)", border: "1px solid var(--gold-border)", borderRadius: 100, padding: "6px 16px 6px 10px", fontSize: 13, color: "#f5a623", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5a623", display: "inline-block" }} />
                Solar Finance for Nigerian Businesses & Homes
              </span>
            </div>

            <h1 className="hero-h1 display hero-h1-text" style={{ fontSize: "clamp(44px, 7vw, 76px)", lineHeight: 1.05, fontWeight: 800, color: "white", marginBottom: 28, letterSpacing: "-1.5px" }}>
              End your generator<br />
              <span style={{ color: "#f5a623" }}>dependency.</span><br />
              Start saving today.
            </h1>

            <p className="hero-sub" style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.7, marginBottom: 40, maxWidth: 520 }}>
              Finance your solar installation — commercial or residential — with up to ₦150M over 36 months. Apply in minutes, get a credit decision in 48 hours.
            </p>

            <div className="hero-ctas" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link href="/sign-up" className="btn-primary">
                Apply for Solar Finance →
              </Link>
              <Link href="/sign-in" className="btn-ghost">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "0 48px 96px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="stats-row stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { value: "48 hrs", label: "Credit Decision", sub: "From application to answer" },
            { value: "36 mo", label: "Max Repayment Tenor", sub: "Spread costs comfortably" },
            { value: "₦150M", label: "Max Facility Size", sub: "For large commercial installs" },
          ].map(({ value, label, sub }) => (
            <div key={label} className="stat-card">
              <div className="display" style={{ fontSize: 36, fontWeight: 800, color: "#f5a623", letterSpacing: "-1px", marginBottom: 6 }}>{value}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" style={{ marginBottom: 96 }} />

      {/* Who it's for */}
      <section style={{ padding: "0 48px 96px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.15em", color: "#f5a623", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Who it's for</p>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
            Built for every sector<br />that's tired of paying for power twice.
          </h2>
        </div>

        <div className="chips-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {[
            { icon: "🏭", label: "Factories & Warehouses" },
            { icon: "🏥", label: "Clinics & Hospitals" },
            { icon: "🏫", label: "Schools & Universities" },
            { icon: "🌾", label: "Agro-Processing Mills" },
            { icon: "🏢", label: "Commercial Buildings" },
            { icon: "🏠", label: "Residential Homes" },
            { icon: "🏪", label: "Retail & Shopping Centres" },
            { icon: "💧", label: "Boreholes & Cold Storage" },
          ].map(({ icon, label }) => (
            <div key={label} className="audience-chip">
              <span style={{ fontSize: 18 }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" style={{ marginBottom: 96 }} />

      {/* How it works */}
      <section style={{ padding: "0 48px 96px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.15em", color: "#f5a623", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>How it works</p>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
            From application to installation<br />in four steps.
          </h2>
        </div>

        <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { n: "01", icon: "📋", title: "Register & Profile", body: "Create an account and complete your business profile — registered name, CAC number, directors, and energy spend." },
            { n: "02", icon: "📁", title: "Upload Documents", body: "Submit your bank statements, audited financials, installer quote, electricity bills, and property proof. All in one place." },
            { n: "03", icon: "🔍", title: "KYC & Credit Review", body: "Our analysts run BVN and CAC verification, review your documents, and generate a credit score within 48 hours." },
            { n: "04", icon: "⚡", title: "Get Funded", body: "Receive an approval decision with terms. Funds are disbursed directly to your certified solar installer." },
          ].map(({ n, icon, title, body }) => (
            <div key={n} className="step-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <span className="display" style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.05em" }}>{n}</span>
              </div>
              <h3 className="display" style={{ fontSize: 17, fontWeight: 700, color: "white", marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" style={{ marginBottom: 0 }} />

      {/* CTA Banner */}
      <section style={{ padding: "96px 48px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--navy-2) 0%, #0c1829 100%)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <h2 className="display" style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, color: "white", letterSpacing: "-1px", marginBottom: 20 }}>
            Your generators cost more<br />than your solar loan will.
          </h2>
          <p style={{ fontSize: 17, color: "#64748b", lineHeight: 1.7, marginBottom: 40 }}>
            The average Nigerian business spends ₦600,000+ monthly on diesel. Solar financing lets you redirect that spend into an asset you own.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/sign-up" className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }}>
              Start Your Application →
            </Link>
            <Link href="/sign-in" className="btn-ghost" style={{ fontSize: 16, padding: "16px 40px" }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "36px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <a href="/" className="logo-mark" style={{ fontSize: 15 }}>
          <div className="logo-sun" style={{ width: 22, height: 22 }} />
          SolarCredit
        </a>
        <p style={{ fontSize: 13, color: "#334155" }}>
          © {new Date().getFullYear()} SolarCredit · Powered by Lucred Credit Engine
        </p>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/sign-up" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Apply</Link>
          <Link href="/sign-in" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Sign In</Link>
        </div>
      </footer>
    </>
  );
}
