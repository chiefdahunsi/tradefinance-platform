"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { parseApiError } from "@/lib/errors";
import { Spinner } from "@/components/shared/spinner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("This reset link is missing a token. Please request a new one.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => router.push("/sign-in"), 3000);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "#f8fafc" }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #f5a623, #e0850d)" }} />

      <div className="w-full max-w-md animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-slate-900 text-lg tracking-tight">SolarCredit</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
                style={{ background: "rgba(22,163,74,0.1)" }}>✓</div>
              <h2 className="font-display font-bold text-slate-900 text-lg mb-2">Password updated!</h2>
              <p className="text-sm text-slate-500">Your password has been reset. Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-xl font-bold text-slate-900">Choose a new password</h1>
                <p className="text-slate-500 text-sm mt-1">Must be at least 8 characters</p>
              </div>

              {error && (
                <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                  {!token && (
                    <span className="ml-2">
                      <Link href="/forgot-password" className="underline font-medium">Request a new link →</Link>
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoFocus placeholder="Min. 8 characters"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none bg-slate-50 transition-colors" />
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 8 characters</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm new password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    required placeholder="Re-enter your password"
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none bg-slate-50 transition-colors ${mismatch ? "border-red-400" : "border-slate-200"}`} />
                  {mismatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                  {!mismatch && confirm.length > 0 && password === confirm && (
                    <p className="text-xs mt-1 text-green-600">✓ Passwords match</p>
                  )}
                </div>
                <button type="submit" disabled={loading || !password || !confirm || !token || mismatch}
                  className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                  style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                  {loading && <Spinner />}
                  {loading ? "Updating…" : "Reset Password →"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: "#f5a623" }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
