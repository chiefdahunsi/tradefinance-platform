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
  commodityType: string;
  tenor: number;
  createdAt: string;
  creditProfile?: { totalScore: number; scoreGrade: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  KYC_PENDING: "bg-yellow-100 text-yellow-700",
  KYC_VERIFIED: "bg-green-100 text-green-700",
  KYC_FAILED: "bg-red-100 text-red-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
  MORE_INFO_REQUIRED: "bg-orange-100 text-orange-700",
};

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;           // wait for auth to hydrate from localStorage
    if (!user) { router.push("/sign-in"); return; }
    Promise.all([
      api.get("/api/business/me").then((r) => setHasBusiness(!!r.data.data)),
      api.get("/api/applications/mine").then((r) => setApplications(r.data.data)),
    ]).finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner className="text-green-600 w-6 h-6" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-slate-500 text-sm">Trade Finance Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {hasBusiness && (
            <Link
              href="/dashboard/apply"
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Application
            </Link>
          )}
          <NotificationBell />
          <button onClick={() => { logout(); router.push("/sign-in"); }} className="text-slate-400 hover:text-slate-600 text-sm">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Onboarding prompt */}
        {hasBusiness === false && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">Complete your business profile</p>
              <p className="text-green-700 text-sm mt-0.5">
                You need to set up your business profile before applying for a facility.
              </p>
            </div>
            <Link
              href="/dashboard/onboarding"
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Set Up Profile →
            </Link>
          </div>
        )}

        {/* Applications */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">My Applications</h2>
          <span className="text-sm text-slate-400">{applications.length} total</span>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 mb-4">No applications yet.</p>
            {hasBusiness && (
              <Link href="/dashboard/apply" className="text-green-600 font-medium hover:underline text-sm">
                Start your first application →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/applications/${app.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-green-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-mono text-xs text-slate-400">
                        {app.referenceNumber.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">
                      {app.commodityType.replace(/_/g, " ")} —{" "}
                      ₦{Number(app.amountRequested).toLocaleString()} · {app.tenor} months
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(app.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {app.creditProfile && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        {app.creditProfile.totalScore}
                        <span className="text-sm font-normal text-slate-400 ml-1">/ 100</span>
                      </div>
                      <div className="text-xs text-slate-500">Grade {app.creditProfile.scoreGrade}</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
