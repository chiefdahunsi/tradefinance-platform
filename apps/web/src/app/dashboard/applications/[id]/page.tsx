"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { DocumentLink } from "@/components/shared/document-link";
import { parseApiError } from "@/lib/errors";

const DOCUMENT_TYPES = [
  { value: "CAC_CERTIFICATE", label: "CAC Certificate", required: true },
  { value: "CAC_STATUS_REPORT", label: "CAC Status Report", required: true },
  { value: "MEMART", label: "MEMART / Articles of Association", required: false },
  { value: "AUDITED_FINANCIALS", label: "Audited Financial Statements", required: true },
  { value: "BANK_STATEMENT", label: "Bank Statement (6 months)", required: true },
  { value: "TRADE_CONTRACT", label: "Trade Contract / Purchase Order", required: true },
  { value: "INVOICE", label: "Commercial Invoice", required: false },
  { value: "LETTER_OF_CREDIT", label: "Letter of Credit / SBLC", required: false },
  { value: "WAREHOUSE_RECEIPT", label: "Warehouse Receipt", required: false },
  { value: "DIRECTORS_ID", label: "Directors' ID (Passport/NIN Slip)", required: true },
  { value: "UTILITY_BILL", label: "Utility Bill (address proof)", required: false },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  KYC_PENDING: "bg-yellow-100 text-yellow-700",
  KYC_VERIFIED: "bg-green-100 text-green-700",
  KYC_FAILED: "bg-red-100 text-red-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-800 font-semibold",
  DECLINED: "bg-red-100 text-red-800",
  MORE_INFO_REQUIRED: "bg-orange-100 text-orange-700",
};

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  tenor: number;
  commodityType: string;
  purpose: string;
  tradeDescription: string;
  collateralType?: string;
  collateralValue?: number;
  submittedAt?: string;
  documents: { id: string; type: string; fileName: string; status: string; uploadedAt: string }[];
  kycChecks: { id: string; checkType: string; status: string; notes?: string; checkedAt: string }[];
  business: {
    cacNumber: string;
    directors: { id: string; firstName: string; lastName: string; bvn: string; kycStatus: string }[];
  };
  creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string; summary: string; strengths: string[]; risks: string[]; conditions: string[] };
  analystReview?: { decision: string; notes: string; amountApproved: number; interestRate: number; decidedAt: string };
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runningKyc, setRunningKyc] = useState(false);
  const [timeline, setTimeline] = useState<{ id: string; action: string; createdAt: string; changes?: any }[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState("");

  const fetchApp = () =>
    Promise.all([
      api.get(`/api/applications/${id}`).then((r) => setApp(r.data.data)),
      api.get(`/api/applications/${id}/timeline`).then((r) => setTimeline(r.data.data)),
    ]).finally(() => setLoading(false));

  useEffect(() => { fetchApp(); }, [id]);

  const handleUploadClick = (docType: string) => {
    setActiveUploadType(docType);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadType) return;
    setUploading(activeUploadType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", activeUploadType);
      // Don't set Content-Type manually — axios sets it with the correct boundary for multipart
      await api.post(`/api/documents/${id}`, formData);
      await fetchApp();
    } catch (err: any) {
      setPageError(parseApiError(err));
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handleRunKyc = async () => {
    setRunningKyc(true);
    setPageError("");
    try {
      await api.post(`/api/kyc/run/${id}`);
      await fetchApp();
    } catch (err: any) {
      setPageError(parseApiError(err));
    } finally {
      setRunningKyc(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/applications/${id}/submit`);
      await fetchApp();
    } catch (err: any) {
      setPageError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading...</div>;
  if (!app) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Application not found.</div>;

  const uploadedTypes = app.documents.map((d) => d.type);
  const requiredDocs = DOCUMENT_TYPES.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => uploadedTypes.includes(d.value));
  const isDraft = app.status === "DRAFT";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-slate-600">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900">
              {app.commodityType.replace(/_/g, " ")} Facility
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? "bg-slate-100 text-slate-600"}`}>
              {app.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-slate-500 text-sm font-mono">{app.referenceNumber.slice(0, 8).toUpperCase()}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} className="text-red-400 hover:text-red-600 ml-4 font-medium">✕</button>
          </div>
        )}

        {/* Analyst Decision */}
        {app.analystReview?.decision && (
          <div className={`rounded-xl border p-5 ${app.analystReview.decision === "APPROVED" ? "bg-green-50 border-green-200" : app.analystReview.decision === "DECLINED" ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}>
            <p className="font-semibold text-slate-900 mb-1">Decision: {app.analystReview.decision}</p>
            {app.analystReview.amountApproved && (
              <p className="text-sm text-slate-700">
                Approved Amount: ₦{Number(app.analystReview.amountApproved).toLocaleString()} @ {app.analystReview.interestRate}% p.a.
              </p>
            )}
            {app.analystReview.notes && <p className="text-sm text-slate-600 mt-2">{app.analystReview.notes}</p>}
          </div>
        )}

        {/* Facility Summary */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Facility Summary</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Amount" value={`₦${Number(app.amountRequested).toLocaleString()}`} />
            <Stat label="Tenor" value={`${app.tenor} months`} />
            <Stat label="Commodity" value={app.commodityType.replace(/_/g, " ")} />
            <Stat label="Collateral" value={app.collateralType || "None"} />
          </dl>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Purpose</p>
            <p className="text-sm text-slate-700">{app.purpose}</p>
          </div>
        </section>

        {/* KYC Verification */}
        {app.status !== "DRAFT" && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">KYC Verification</h2>
                <p className="text-slate-500 text-xs mt-0.5">BVN and CAC checks run automatically on submission</p>
              </div>
              {(app.status === "KYC_FAILED" || app.status === "KYC_PENDING") && (
                <button
                  onClick={handleRunKyc}
                  disabled={runningKyc}
                  className="flex items-center gap-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  {runningKyc ? <><Spinner className="w-3 h-3" /> Running...</> : "↺ Re-run checks"}
                </button>
              )}
            </div>

            {/* Director BVN status */}
            {app.business?.directors?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Directors — BVN</p>
                <div className="space-y-2">
                  {app.business.directors.map((dir) => (
                    <div key={dir.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-700">{dir.firstName} {dir.lastName}</span>
                      <KYCBadge status={dir.kycStatus} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CAC + other checks */}
            {app.kycChecks?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Business — CAC</p>
                {app.kycChecks
                  .filter((c) => c.checkType === "CAC")
                  .slice(-1)
                  .map((check) => (
                    <div key={check.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-sm text-slate-700">CAC Registration · {app.business.cacNumber}</span>
                        {check.notes && <p className="text-xs text-slate-400 mt-0.5">{check.notes}</p>}
                      </div>
                      <KYCBadge status={check.status} />
                    </div>
                  ))}
              </div>
            )}

            {/* No checks yet */}
            {(!app.kycChecks || app.kycChecks.length === 0) && (
              <p className="text-sm text-slate-400">KYC checks pending. They run automatically after submission.</p>
            )}
          </section>
        )}

        {/* Credit Profile */}
        {app.creditProfile && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Credit Profile</h2>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-900">{app.creditProfile.totalScore}</div>
                <div className="text-slate-400 text-xs mt-0.5">out of 100</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">Grade {app.creditProfile.scoreGrade}</div>
                <div className="text-sm text-slate-600">{app.creditProfile.recommendation}</div>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">{app.creditProfile.summary}</p>
            {app.creditProfile.strengths.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths</p>
                <ul className="space-y-0.5">{app.creditProfile.strengths.map((s, i) => <li key={i} className="text-sm text-slate-600">• {s}</li>)}</ul>
              </div>
            )}
            {app.creditProfile.risks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">⚠ Risks</p>
                <ul className="space-y-0.5">{app.creditProfile.risks.map((r, i) => <li key={i} className="text-sm text-slate-600">• {r}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        {/* Document Upload */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Documents</h2>
          <p className="text-slate-500 text-sm mb-5">PDF, JPG or PNG · Max 10MB per file</p>

          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />

          <div className="space-y-2">
            {DOCUMENT_TYPES.map((doc) => {
              const uploaded = app.documents.find((d) => d.type === doc.value);
              const isUploading = uploading === doc.value;
              return (
                <div key={doc.value} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${uploaded ? "bg-green-500 text-white" : "bg-slate-200"}`}>
                      {uploaded ? "✓" : ""}
                    </span>
                    <div>
                      <span className="text-sm text-slate-700">{doc.label}</span>
                      {doc.required && <span className="text-red-400 text-xs ml-1">*</span>}
                      {uploaded && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-400">{uploaded.fileName}</p>
                          <DocumentLink documentId={uploaded.id} fileName={uploaded.fileName} className="text-xs text-blue-600 hover:underline" />
                        </div>
                      )}
                    </div>
                  </div>
                  {isDraft && (
                    <button
                      onClick={() => handleUploadClick(doc.value)}
                      disabled={isUploading}
                      className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50"
                    >
                      {isUploading ? <><Spinner className="text-green-600" /> Uploading...</> : uploaded ? "Replace" : "Upload"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Activity Timeline</h2>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 pl-8 relative">
                    <span className="absolute left-0 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs">
                      {TIMELINE_ICON[entry.action] ?? "•"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {TIMELINE_LABEL[entry.action] ?? entry.action.replace(/.*:/, "").replace(/_/g, " ")}
                        {(entry.changes as any)?.decision && (
                          <span className={`ml-2 text-xs font-semibold ${
                            (entry.changes as any).decision === "APPROVED" ? "text-green-600" :
                            (entry.changes as any).decision === "DECLINED" ? "text-red-600" : "text-orange-600"
                          }`}>
                            — {(entry.changes as any).decision}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Submit */}
        {isDraft && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Submit Application</h2>
            <p className="text-slate-500 text-sm mb-4">
              {allRequiredUploaded
                ? "All required documents uploaded. You're ready to submit."
                : `${requiredDocs.filter((d) => !uploadedTypes.includes(d.value)).length} required document(s) still missing.`}
            </p>
            <button
              onClick={handleSubmit}
              disabled={!allRequiredUploaded || submitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {submitting && <Spinner />}
              {submitting ? "Submitting..." : "Submit for Review →"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 font-medium">{label}</dt>
      <dd className="text-slate-800 font-medium mt-0.5">{value}</dd>
    </div>
  );
}

const TIMELINE_ICON: Record<string, string> = {
  "APPLICATION:SUBMITTED": "📋",
  "KYC:PASSED": "✅",
  "KYC:FAILED": "⚠️",
  "ANALYST:ASSIGNED": "👤",
  "ANALYST:CREDIT_PROFILE_GENERATED": "📊",
  "ANALYST:DECISION_SUBMITTED": "🏦",
};

const TIMELINE_LABEL: Record<string, string> = {
  "APPLICATION:SUBMITTED": "Application submitted",
  "KYC:PASSED": "KYC verification passed",
  "KYC:FAILED": "KYC verification issue detected",
  "ANALYST:ASSIGNED": "Assigned to a credit analyst",
  "ANALYST:CREDIT_PROFILE_GENERATED": "Credit profile generated",
  "ANALYST:DECISION_SUBMITTED": "Decision made",
};

function KYCBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PASSED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    PENDING: "bg-yellow-100 text-yellow-700",
  };
  const icons: Record<string, string> = { PASSED: "✓", FAILED: "✕", PENDING: "⏳" };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {icons[status] ?? ""} {status}
    </span>
  );
}
