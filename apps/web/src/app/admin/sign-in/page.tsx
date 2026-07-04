"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError } from "@/lib/errors";

export default function AdminSignInPage() {
  const { analystLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await analystLogin(email, password);
      if (user.role !== "ADMIN") {
        setError("This portal is for administrators only. Use the Analyst Portal if you are an analyst.");
        return;
      }
      router.push("/admin");
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#09090b" }}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
          <span className="font-display font-bold text-white text-xl tracking-tight">SolarCredit</span>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 border text-xs font-semibold tracking-widest uppercase"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Admin Panel
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Administrator Sign In</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">Platform management and oversight</p>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-zinc-300">Email address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="admin@solarcredit.ng" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-zinc-300">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "white", color: "#09090b" }}>
              {loading && <Spinner className="text-current" />}
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-2 text-center text-sm text-zinc-600">
          <p><Link href="/analyst/sign-in" className="hover:text-zinc-400 transition-colors">Analyst Portal →</Link></p>
          <p><Link href="/sign-in" className="hover:text-zinc-400 transition-colors">Applicant Portal →</Link></p>
        </div>
      </div>
    </div>
  );
}
