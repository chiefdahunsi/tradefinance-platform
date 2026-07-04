"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { parseApiError } from "@/lib/errors";
import { Spinner } from "@/components/shared/spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#f8fafc" }}>
      {/* Subtle top accent */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #f5a623, #e0850d)" }} />

      <div className="w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-slate-900 text-lg tracking-tight">SolarCredit</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
                style={{ background: "rgba(245,166,35,0.1)" }}>✉</div>
              <h2 className="font-display font-bold text-slate-900 text-lg mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                If an account exists for <span className="font-medium text-slate-700">{email}</span>, you&apos;ll receive a reset link within a few minutes.
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button onClick={() => { setSubmitted(false); setEmail(""); }}
                  className="font-medium hover:underline" style={{ color: "#f5a623" }}>
                  try again
                </button>.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-xl font-bold text-slate-900">Reset your password</h1>
                <p className="text-slate-500 text-sm mt-1">Enter your email — we&apos;ll send a reset link</p>
              </div>
              {error && (
                <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoFocus placeholder="you@company.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-slate-50 transition-colors" />
                </div>
                <button type="submit" disabled={loading || !email}
                  className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                  style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                  {loading && <Spinner />}
                  {loading ? "Sending…" : "Send Reset Link →"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Remember your password?{" "}
          <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: "#f5a623" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
