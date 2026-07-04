"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError } from "@/lib/errors";

export default function SignUpPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const passwordMismatch =
    passwordTouched && form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, password: form.password });
      router.push("/dashboard/onboarding");
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
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
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
              Get Started
            </p>
            <h2 className="font-display text-4xl font-bold text-white leading-tight">
              Join thousands of<br />businesses going solar.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed text-sm">
              Create your account in minutes. Upload documents, get KYC verified, and receive a credit decision — all in one place.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { step: "01", label: "Create account & complete business profile" },
              { step: "02", label: "Upload KYC and financial documents" },
              { step: "03", label: "Receive credit decision in 48 hours" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="font-display text-xs font-bold mt-0.5 shrink-0" style={{ color: "#f5a623" }}>{item.step}</span>
                <p className="text-slate-400 text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-xs">Powered by Lucred Credit Engine · NDIC Compliant</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-up">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-slate-900">SolarCredit</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-slate-900">Create your account</h1>
            <p className="text-slate-500 mt-1.5 text-sm">Start your solar finance application</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="First name">
                  <input type="text" required value={form.firstName} onChange={set("firstName")} className={inp} placeholder="Chidi" />
                </Field>
                <Field label="Last name">
                  <input type="text" required value={form.lastName} onChange={set("lastName")} className={inp} placeholder="Okonkwo" />
                </Field>
              </div>

              <Field label="Email address">
                <input type="email" required value={form.email} onChange={set("email")} className={inp} placeholder="chidi@company.com" />
              </Field>

              <Field label="Phone number">
                <input type="tel" value={form.phone} onChange={set("phone")} className={inp} placeholder="08012345678" />
              </Field>

              <Field label="Password">
                <input type="password" required minLength={8} value={form.password}
                  onChange={(e) => { set("password")(e); setPasswordTouched(true); }} className={inp} placeholder="At least 8 characters" />
                {form.password.length > 0 && form.password.length < 8 && (
                  <p className="text-xs text-red-500 mt-1">Minimum 8 characters</p>
                )}
              </Field>

              <Field label="Confirm password">
                <input type="password" required value={form.confirmPassword} onChange={set("confirmPassword")}
                  className={`${inp} ${passwordMismatch ? "border-red-400" : ""}`} placeholder="••••••••" />
                {passwordMismatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                {!passwordMismatch && form.confirmPassword.length > 0 && form.password === form.confirmPassword && (
                  <p className="text-xs mt-1" style={{ color: "#22c55e" }}>✓ Passwords match</p>
                )}
              </Field>

              <button type="submit" disabled={loading || passwordMismatch}
                className="w-full disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                {loading && <Spinner />}
                {loading ? "Creating account…" : "Create Account →"}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: "#f5a623" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors";
