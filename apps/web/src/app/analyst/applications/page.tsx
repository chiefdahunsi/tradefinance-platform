"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AnalystShell } from "@/components/layout/analyst-shell";
import { parseApiError } from "@/lib/errors";

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  commodityType: string;
  tenor: number;
  submittedAt: string;
  business: { registeredName: string; cacNumber: string; state: string };
  creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string };
  analystReview?: { decision: string };
}

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700",
  KYC_PENDING: "bg-yellow-50 text-yellow-700",
  KYC_VERIFIED: "bg-green-50 text-green-700",
  KYC_FAILED: "bg-red-50 text-red-700",
  UNDER_REVIEW: "bg-purple-50 text-purple-700",
  APPROVED: "bg-green-50 text-green-800",
  DECLINED: "bg-red-50 text-red-800",
  MORE_INFO_REQUIRED: "bg-orange-50 text-orange-700",
};

const STATUSES = ["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "MORE_INFO_REQUIRED"];

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
          <h1 className="text-xl font-bold text-slate-900">All Applications</h1>
          <p className="text-slate-500 text-sm mt-0.5">All submitted facility applications</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No applications found.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Business", "Commodity", "Amount", "Tenor", "Status", "Score", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{app.business.registeredName}</p>
                      <p className="text-xs text-slate-400 font-mono">{app.referenceNumber.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{app.commodityType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">₦{Number(app.amountRequested).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{app.tenor}m</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {app.creditProfile ? (
                        <span className="font-semibold text-slate-700">{app.creditProfile.totalScore} <span className="text-slate-400 font-normal text-xs">/ 100</span></span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {app.analystReview ? (
                        <Link href={`/analyst/applications/${app.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                          View →
                        </Link>
                      ) : (
                        <button
                          onClick={(e) => assignToSelf(e, app.id)}
                          disabled={assigning === app.id}
                          className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          {assigning === app.id ? "Assigning..." : "Assign to me"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AnalystShell>
  );
}
