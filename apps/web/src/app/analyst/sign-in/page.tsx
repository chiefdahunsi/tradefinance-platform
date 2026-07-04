"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError } from "@/lib/errors";

export default function AnalystSignInPage() {
  const { analystLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await analystLogin(email, password);
      router.push("/analyst/queue");
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#070c1a" }}>
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
      {/* Faint glow */}
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] opacity-10 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle at bottom right, #f5a623 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
          <span className="font-display font-bold text-white text-xl tracking-tight">SolarCredit</span>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 border text-xs font-semibold tracking-widest uppercase"
            style={{ borderColor: "rgba(245,166,35,0.3)", color: "#f5a623", background: "rgba(245,166,35,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Analyst Portal
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Staff Sign In</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Credit analyst and admin access</p>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-300">Email address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="analyst@solarcredit.ng" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-300">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
              {loading && <Spinner className="text-current" />}
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-6">
          Not an analyst?{" "}
          <Link href="/sign-in" className="text-slate-400 font-medium hover:text-slate-200 transition-colors">
            Go to Applicant Portal →
          </Link>
        </p>
      </div>
    </div>
  );
}
