"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError } from "@/lib/errors";

export default function SignInPage() {
  const { login } = useAuth();
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
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #070c1a 0%, #0d1f3c 100%)" }}>
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f5a623 0%, transparent 70%)" }} />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-700 text-white text-lg tracking-tight">SolarCredit</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "#f5a623" }}>
              Applicant Portal
            </p>
            <h2 className="font-display text-4xl font-bold text-white leading-tight">
              Power your business.<br />Finance it smart.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed text-sm">
              Apply for solar installation financing up to ₦150M. Fast KYC, transparent scoring, and decisions in 48 hours.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { label: "Max Facility", value: "₦150M" },
              { label: "Max Tenor", value: "36 mo" },
              { label: "Decision", value: "48 hrs" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                <p className="font-display font-bold text-xl" style={{ color: "#f5a623" }}>{s.value}</p>
                <p className="text-slate-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-xs">Powered by Lucred Credit Engine · NDIC Compliant</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-slate-900">SolarCredit</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500 mt-1.5 text-sm">Sign in to manage your facility applications</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors"
                  style={{ "--tw-ring-color": "#f5a623" } as any}
                  onFocus={(e) => e.target.style.borderColor = "#f5a623"}
                  onBlur={(e) => e.target.style.borderColor = ""}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: "#f5a623" }}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}
              >
                {loading && <Spinner />}
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>
          </div>

          <div className="space-y-3 mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="font-semibold hover:underline" style={{ color: "#f5a623" }}>
                Apply now
              </Link>
            </p>
            <p className="text-sm text-slate-400">
              Are you an analyst?{" "}
              <Link href="/analyst/sign-in" className="text-slate-600 font-medium hover:underline">
                Analyst sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
