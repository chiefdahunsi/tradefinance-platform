"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Spinner } from "@/components/shared/spinner";
import { NotificationBell } from "@/components/shared/notification-bell";

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  systemType: string;
  tenor: number;
  createdAt: string;
  creditProfile?: { totalScore: number; scoreGrade: string };
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:              { label: "Draft",            color: "#64748b", bg: "#f1f5f9" },
  SUBMITTED:          { label: "Submitted",        color: "#2563eb", bg: "#eff6ff" },
  KYC_PENDING:        { label: "KYC Pending",      color: "#d97706", bg: "#fffbeb" },
  KYC_VERIFIED:       { label: "KYC Verified",     color: "#16a34a", bg: "#f0fdf4" },
  KYC_FAILED:         { label: "KYC Failed",       color: "#dc2626", bg: "#fef2f2" },
  UNDER_REVIEW:       { label: "Under Review",     color: "#7c3aed", bg: "#f5f3ff" },
  APPROVED:           { label: "Approved",         color: "#15803d", bg: "#dcfce7" },
  DECLINED:           { label: "Declined",         color: "#b91c1c", bg: "#fee2e2" },
  MORE_INFO_REQUIRED: { label: "More Info Needed", color: "#ea580c", bg: "#fff7ed" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "#16a34a", B: "#65a30d", C: "#d97706", D: "#ea580c", E: "#dc2626", F: "#9f1239",
};

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/sign-in"); return; }
    Promise.all([
      api.get("/api/business/me").then((r) => setHasBusiness(!!r.data.data)),
      api.get("/api/applications/mine").then((r) => setApplications(r.data.data)),
    ]).finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
      <Spinner className="w-6 h-6" style={{ color: "#f5a623" } as any} />
    </div>
  );

  const activeApps = applications.filter((a) => !["DRAFT", "DECLINED"].includes(a.status));
  const totalAmount = applications.reduce((s, a) => s + Number(a.amountRequested), 0);

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Top nav */}
      <header className="bg-white border-b border-slate-100 px-6 py-0 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
              <span className="font-display font-bold text-slate-900 text-base tracking-tight">SolarCredit</span>
            </Link>
            <span className="text-slate-200 text-lg font-light">/</span>
            <span className="text-slate-500 text-sm">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {hasBusiness && (
              <Link href="/dashboard/profile"
                className="text-slate-600 text-sm font-medium px-3.5 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                Profile
              </Link>
            )}
            {hasBusiness && (
              <Link href="/dashboard/apply"
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
                + New Application
              </Link>
            )}
            <NotificationBell />
            <button onClick={() => { logout(); router.push("/sign-in"); }}
              className="text-slate-400 hover:text-slate-600 text-sm px-2 py-2 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Good day, {user?.firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">Here&apos;s an overview of your solar finance applications.</p>
        </div>

        {/* Onboarding prompt */}
        {hasBusiness === false && (
          <div className="rounded-2xl p-6 mb-8 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #070c1a 0%, #0d1f3c 100%)" }}>
            <div>
              <p className="font-display font-bold text-white text-lg">Complete your business profile</p>
              <p className="text-slate-400 text-sm mt-1">Set up your business profile to start applying for solar financing.</p>
            </div>
            <Link href="/dashboard/onboarding"
              className="shrink-0 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all ml-6"
              style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
              Set Up Profile →
            </Link>
          </div>
        )}

        {/* Stats row */}
        {applications.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Applications", value: applications.length },
              { label: "Active Applications", value: activeApps.length },
              { label: "Total Requested", value: `₦${(totalAmount / 1_000_000).toFixed(1)}M` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{s.label}</p>
                <p className="font-display text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Applications list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-slate-900">My Applications</h2>
          <span className="text-sm text-slate-400">{applications.length} total</span>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
              style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.12), rgba(245,166,35,0.06))" }}>
              ☀
            </div>
            <p className="font-display font-semibold text-slate-700 mb-1">No applications yet</p>
            <p className="text-slate-400 text-sm mb-5">Start your first solar finance application.</p>
            {hasBusiness && (
              <Link href="/dashboard/apply"
                className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
                Apply Now →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const meta = STATUS_META[app.status] ?? { label: app.status, color: "#64748b", bg: "#f1f5f9" };
              const grade = app.creditProfile?.scoreGrade;
              return (
                <Link key={app.id} href={`/dashboard/applications/${app.id}`}
                  className="block bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="font-mono text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          {app.referenceNumber.slice(0, 12).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          style={{ color: meta.color, background: meta.bg }}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-slate-800 font-semibold truncate">
                        {app.systemType.replace(/_/g, " ")} Solar Installation
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-sm text-slate-500">₦{Number(app.amountRequested).toLocaleString()}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-sm text-slate-500">{app.tenor} months</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs text-slate-400">
                          {new Date(app.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {app.creditProfile && (
                        <div className="text-right">
                          <div className="font-display text-2xl font-bold"
                            style={{ color: GRADE_COLOR[grade ?? "F"] ?? "#64748b" }}>
                            {app.creditProfile.totalScore}
                          </div>
                          <div className="text-xs text-slate-400">Grade {grade}</div>
                        </div>
                      )}
                      <span className="text-slate-300 group-hover:text-slate-500 transition-colors">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
