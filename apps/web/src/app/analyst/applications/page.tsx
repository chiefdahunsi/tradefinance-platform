"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AnalystShell } from "@/components/layout/analyst-shell";
import { parseApiError } from "@/lib/errors";
import { Spinner } from "@/components/shared/spinner";

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  systemType: string;
  tenor: number;
  submittedAt: string;
  business: { registeredName: string; cacNumber: string; state: string };
  creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string };
  analystReview?: { decision: string };
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
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

const STATUSES = ["ALL", "SUBMITTED", "UNDER_REVIEW", "KYC_VERIFIED", "APPROVED", "DECLINED", "MORE_INFO_REQUIRED"];

export default function AllApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchApps = (s: string) => {
    setLoading(true);
    const query = s !== "ALL" ? `?status=${s}` : "";
    api.get(`/api/applications${query}`)
      .then((r) => setApplications(r.data.data))
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApps(status); }, [status]);

  const assignToSelf = async (e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    setAssigning(appId);
    try {
      await api.post(`/api/analyst/${appId}/assign`);
      fetchApps(status);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <AnalystShell>
      <div className="px-8 py-7">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold text-slate-900">All Applications</h1>
          <p className="text-slate-500 text-sm mt-0.5">All submitted facility applications</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={status === s
                ? { background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }
                : { background: "white", border: "1px solid #e2e8f0", color: "#64748b" }}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <Spinner className="w-4 h-4 text-slate-400" /> Loading…
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
            No applications found.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr>
                  {["Business", "System Type", "Amount", "Tenor", "Status", "Score", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {applications.map((app) => {
                  const meta = STATUS_META[app.status];
                  const grade = app.creditProfile?.scoreGrade;
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{app.business.registeredName}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{app.referenceNumber.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{app.systemType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">₦{Number(app.amountRequested).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{app.tenor}m</td>
                      <td className="px-4 py-3">
                        {meta ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">{app.status.replace(/_/g, " ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {app.creditProfile ? (
                          <span className="font-display font-bold text-base" style={{ color: GRADE_COLOR[grade ?? "F"] ?? "#64748b" }}>
                            {app.creditProfile.totalScore}
                            <span className="text-slate-300 font-normal text-xs ml-0.5">/100</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {app.analystReview ? (
                          <Link href={`/analyst/applications/${app.id}`}
                            className="text-xs font-semibold hover:underline" style={{ color: "#f5a623" }}>
                            View →
                          </Link>
                        ) : (
                          <button onClick={(e) => assignToSelf(e, app.id)} disabled={assigning === app.id}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 transition-colors">
                            {assigning === app.id ? "Assigning…" : "Assign to me"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AnalystShell>
  );
}
