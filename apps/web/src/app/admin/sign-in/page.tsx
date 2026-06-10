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
    setError("");
    setLoading(true);
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Admin Panel</p>
          <h1 className="text-2xl font-bold text-white">Administrator Sign In</h1>
          <p className="text-zinc-400 mt-1 text-sm">Platform management and oversight</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email address</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                placeholder="admin@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-white hover:bg-zinc-100 disabled:opacity-60 text-zinc-900 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Spinner className="text-zinc-600" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-2 text-center text-sm text-zinc-600">
          <p>
            <Link href="/analyst/sign-in" className="hover:text-zinc-400 transition-colors">Analyst Portal →</Link>
          </p>
          <p>
            <Link href="/sign-in" className="hover:text-zinc-400 transition-colors">Applicant Portal →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
