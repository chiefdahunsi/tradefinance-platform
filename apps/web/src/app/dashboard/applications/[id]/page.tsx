"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { DocumentLink } from "@/components/shared/document-link";
import { parseApiError } from "@/lib/errors";

const DOCUMENT_TYPES = [
  { value: "CAC_CERTIFICATE",   label: "CAC Certificate",                        required: true,  hint: "Certificate of Incorporation issued by CAC" },
  { value: "CAC_STATUS_REPORT", label: "CAC Status Report",                      required: true,  hint: "Current status report showing the company is active" },
  { value: "MEMART",            label: "MEMART / Articles of Association",       required: true,  hint: "Required for all limited liability companies" },
  { value: "AUDITED_FINANCIALS",label: "Audited Financial Statements (3 Years)", required: true,  hint: "Audited accounts for the last 3 financial years, signed by a registered auditor" },
  { value: "BANK_STATEMENT",    label: "Bank Statement (Last 12 Months)",        required: true,  hint: "Full 12-month statement for your primary account, stamped by the bank" },
  { value: "ELECTRICITY_BILL",  label: "Recent Electricity / Generator Bill",    required: true,  hint: "Last 3 months of DISCO bills or diesel invoices" },
  { value: "INSTALLATION_QUOTE",label: "Installer Quotation",                    required: true,  hint: "Formal quote from a certified solar installer" },
  { value: "SITE_ASSESSMENT",   label: "Site Assessment Report",                 required: false, hint: "Technical assessment of the installation site" },
  { value: "PROPERTY_PROOF",    label: "Proof of Property Ownership / Tenancy",  required: true,  hint: "Certificate of Occupancy, deed of assignment, or tenancy agreement" },
  { value: "DIRECTORS_ID",      label: "Directors' / Guarantors' ID",            required: true,  hint: "Valid government-issued ID for each director or guarantor" },
  { value: "PASSPORT_PHOTOGRAPH",label: "Passport Photograph",                   required: true,  hint: "Recent passport-sized photo, white background, within last 6 months" },
  { value: "UTILITY_BILL",      label: "Utility Bill (Address Proof)",           required: true,  hint: "Recent utility bill not older than 3 months, matching your business address" },
  { value: "PROOF_OF_COLLATERAL",label: "Proof of Collateral",                   required: false, hint: "Land title, domiciliation letter, or equipment valuation" },
];

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

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  tenor: number;
  systemType: string;
  systemSizeKwp?: number;
  projectAddress?: string;
  purpose: string;
  projectDescription: string;
  collateralType?: string;
  collateralValue?: number;
  submittedAt?: string;
  documents: { id: string; type: string; fileName: string; status: string; rejectionReason?: string; uploadedAt: string }[];
  kycChecks: { id: string; checkType: string; status: string; notes?: string; checkedAt: string }[];
  business: {
    cacNumber: string;
    directors: { id: string; firstName: string; lastName: string; bvn: string; kycStatus: string }[];
  };
  creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string; summary: string; strengths: string[]; risks: string[]; conditions: string[] };
  analystReview?: { decision: string; notes: string; amountApproved: number; interestRate: number; decidedAt: string };
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

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runningKyc, setRunningKyc] = useState(false);
  const [runningBvn, setRunningBvn] = useState<Record<string, boolean>>({});
  const [runningCac, setRunningCac] = useState(false);
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
    setRunningKyc(true); setPageError("");
    try { await api.post(`/api/kyc/run/${id}`); await fetchApp(); }
    catch (err: any) { setPageError(parseApiError(err)); }
    finally { setRunningKyc(false); }
  };

  const handleRunBvn = async (directorId: string, bvn: string, dateOfBirth: string) => {
    setRunningBvn((p) => ({ ...p, [directorId]: true })); setPageError("");
    try { await api.post(`/api/kyc/bvn`, { directorId, bvn, dateOfBirth: dateOfBirth || "1900-01-01" }); await fetchApp(); }
    catch (err: any) { setPageError(parseApiError(err)); }
    finally { setRunningBvn((p) => ({ ...p, [directorId]: false })); }
  };

  const handleRunCac = async () => {
    if (!app) return;
    setRunningCac(true); setPageError("");
    try { await api.post(`/api/kyc/cac`, { applicationId: id, cacNumber: app.business.cacNumber }); await fetchApp(); }
    catch (err: any) { setPageError(parseApiError(err)); }
    finally { setRunningCac(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await api.post(`/api/applications/${id}/submit`); await fetchApp(); }
    catch (err: any) { setPageError(parseApiError(err)); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
      <Spinner className="w-5 h-5" />
    </div>
  );
  if (!app) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400" style={{ background: "#f8fafc" }}>
      Application not found.
    </div>
  );

  const uploadedTypes = app.documents.map((d) => d.type);
  const requiredDocs = DOCUMENT_TYPES.filter((d) => d.required);
  const missingRequired = requiredDocs.filter((d) => !uploadedTypes.includes(d.value));
  const allRequiredUploaded = missingRequired.length === 0;
  const isDraft = app.status === "DRAFT";
  const canUpload = !["APPROVED", "DISBURSED"].includes(app.status);
  const statusMeta = STATUS_META[app.status] ?? { label: app.status, color: "#64748b", bg: "#f1f5f9" };
  const gradeColor = app.creditProfile ? (GRADE_COLOR[app.creditProfile.scoreGrade] ?? "#64748b") : null;

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center gap-4 h-16">
          <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-slate-600 transition-colors">←</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display font-bold text-slate-900 truncate">
                {app.systemType.replace(/_/g, " ")} Solar Finance
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                style={{ color: statusMeta.color, background: statusMeta.bg }}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-mono">{app.referenceNumber.slice(0, 12).toUpperCase()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">

        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

        {/* Analyst Decision banner */}
        {app.analystReview?.decision && (
          <div className={`rounded-2xl p-5 ${
            app.analystReview.decision === "APPROVED"
              ? "border border-green-200 bg-green-50"
              : app.analystReview.decision === "DECLINED"
              ? "border border-red-200 bg-red-50"
              : "border border-orange-200 bg-orange-50"
          }`}>
            <p className="font-display font-bold text-slate-900 mb-1">Decision: {app.analystReview.decision}</p>
            {app.analystReview.amountApproved && (
              <p className="text-sm text-slate-700">
                Approved: ₦{Number(app.analystReview.amountApproved).toLocaleString()} @ {app.analystReview.interestRate}% p.a.
              </p>
            )}
            {app.analystReview.notes && <p className="text-sm text-slate-600 mt-2">{app.analystReview.notes}</p>}
          </div>
        )}

        {/* Facility Summary */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="font-display font-semibold text-slate-900 mb-5">Facility Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-5">
            <Stat label="Amount" value={`₦${Number(app.amountRequested).toLocaleString()}`} />
            <Stat label="Tenor" value={`${app.tenor} months`} />
            <Stat label="System Type" value={app.systemType.replace(/_/g, " ")} />
            {app.systemSizeKwp && <Stat label="Estimated Size" value={`${app.systemSizeKwp} kWp`} gold />}
            {app.projectAddress && <Stat label="Installation Address" value={app.projectAddress} />}
            <Stat label="Collateral" value={app.collateralType || "None"} />
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-50">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Purpose</p>
              <p className="text-sm text-slate-700">{app.purpose}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Project Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{app.projectDescription}</p>
            </div>
          </div>
        </section>

        {/* Credit Profile */}
        {app.creditProfile && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Credit Profile</h2>
            <div className="flex items-start gap-6 mb-5">
              <div className="text-center shrink-0">
                <div className="font-display font-bold text-5xl" style={{ color: gradeColor ?? "#64748b" }}>
                  {app.creditProfile.totalScore}
                </div>
                <div className="text-slate-400 text-xs mt-1">out of 100</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl mb-1" style={{ color: gradeColor ?? "#64748b" }}>
                  Grade {app.creditProfile.scoreGrade}
                </div>
                <div className="text-sm text-slate-500">{app.creditProfile.recommendation}</div>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{app.creditProfile.summary}</p>
              </div>
            </div>
            {app.creditProfile.strengths.length > 0 && (
              <div className="mb-3 rounded-xl p-4" style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.15)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#15803d" }}>✓ Strengths</p>
                <ul className="space-y-1">{app.creditProfile.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-600">• {s}</li>
                ))}</ul>
              </div>
            )}
            {app.creditProfile.risks.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)" }}>
                <p className="text-xs font-semibold mb-2 text-red-600">⚠ Risks</p>
                <ul className="space-y-1">{app.creditProfile.risks.map((r, i) => (
                  <li key={i} className="text-sm text-slate-600">• {r}</li>
                ))}</ul>
              </div>
            )}
          </section>
        )}

        {/* KYC Verification */}
        {app.status !== "DRAFT" && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display font-semibold text-slate-900">KYC Verification</h2>
                <p className="text-slate-400 text-xs mt-0.5">Verify each check individually or run all at once</p>
              </div>
              <button onClick={handleRunKyc} disabled={runningKyc}
                className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 hover:border-slate-400 disabled:opacity-50 text-slate-600 px-3 py-1.5 rounded-xl transition-colors">
                {runningKyc ? <><Spinner className="w-3 h-3" /> Running…</> : "↺ Run All"}
              </button>
            </div>
            <div className="space-y-2">
              {/* CAC */}
              <div className="flex items-center justify-between py-3 border-b border-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">🏢 CAC Registration</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{app.business.cacNumber}</p>
                  {app.kycChecks.filter((c) => c.checkType === "CAC").slice(-1).map((c) => (
                    c.notes && <p key={c.id} className="text-xs text-slate-500 mt-0.5">{c.notes}</p>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const latest = app.kycChecks.filter((c) => c.checkType === "CAC").slice(-1)[0];
                    return <KYCBadge status={latest?.status ?? "PENDING"} />;
                  })()}
                  <button onClick={handleRunCac} disabled={runningCac}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition-all"
                    style={{ background: "#070c1a" }}>
                    {runningCac ? <><Spinner className="w-3 h-3 inline mr-1" />Running…</> : "Verify"}
                  </button>
                </div>
              </div>
              {/* Directors BVN */}
              {app.business?.directors?.map((dir) => (
                <div key={dir.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">👤 {dir.firstName} {dir.lastName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">BVN verification</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <KYCBadge status={dir.kycStatus} />
                    <button
                      onClick={() => handleRunBvn(dir.id, dir.bvn, (dir as any).dateOfBirth || "")}
                      disabled={!!runningBvn[dir.id]}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition-all"
                      style={{ background: "#070c1a" }}>
                      {runningBvn[dir.id] ? <><Spinner className="w-3 h-3 inline mr-1" />Running…</> : "Verify"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-slate-900">Documents</h2>
              <p className="text-slate-400 text-xs mt-0.5">PDF, JPG or PNG · Max 10MB per file</p>
            </div>
            {isDraft && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                allRequiredUploaded
                  ? "text-green-700 bg-green-50"
                  : "text-orange-700 bg-orange-50"
              }`}>
                {allRequiredUploaded ? "✓ All required uploaded" : `${missingRequired.length} required missing`}
              </span>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />

          <div className="divide-y divide-slate-50">
            {DOCUMENT_TYPES.map((doc) => {
              const uploaded = app.documents.find((d) => d.type === doc.value);
              const isUploading = uploading === doc.value;
              const isRejected = uploaded?.status === "REJECTED";
              const isApproved = uploaded?.status === "APPROVED";

              return (
                <div key={doc.value}
                  className={`flex items-start justify-between px-6 py-4 gap-3 transition-colors ${
                    isRejected ? "bg-red-50" : isApproved ? "bg-green-50" : ""
                  }`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      isApproved ? "text-white" : isRejected ? "text-white" : uploaded ? "text-white" : "bg-slate-100 text-slate-300"
                    }`}
                      style={isApproved ? { background: "#16a34a" } : isRejected ? { background: "#dc2626" } : uploaded ? { background: "#f5a623" } : {}}>
                      {isRejected ? "✕" : uploaded ? "✓" : ""}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">{doc.label}</span>
                        {doc.required && <span className="text-red-400 text-xs">*</span>}
                        {isApproved && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ color: "#15803d", background: "rgba(22,163,74,0.1)" }}>Approved</span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ color: "#b91c1c", background: "rgba(220,38,38,0.1)" }}>Rejected — re-upload</span>
                        )}
                      </div>
                      {doc.hint && !isRejected && <p className="text-xs text-slate-400 mt-0.5 max-w-sm">{doc.hint}</p>}
                      {isRejected && uploaded?.rejectionReason && (
                        <p className="text-xs text-red-600 mt-0.5 font-medium">Reason: {uploaded.rejectionReason}</p>
                      )}
                      {uploaded && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">{uploaded.fileName}</p>
                          <DocumentLink documentId={uploaded.id} fileName={uploaded.fileName}
                            className="text-xs font-medium hover:underline text-amber-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  {canUpload && (
                    <button onClick={() => handleUploadClick(doc.value)} disabled={isUploading}
                      className={`text-xs font-semibold shrink-0 disabled:opacity-50 flex items-center gap-1 px-3 py-1.5 rounded-xl border transition-colors ${
                        isRejected
                          ? "border-red-200 text-red-600 hover:bg-red-100"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}>
                      {isUploading ? <><Spinner className="w-3 h-3" /> Uploading…</> : isRejected ? "↑ Re-upload" : uploaded ? "Replace" : "Upload"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Activity Timeline</h2>
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-5">
                {timeline.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 pl-10 relative">
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
                          }`}>— {(entry.changes as any).decision}</span>
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
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-1">Submit Application</h2>
            <p className="text-slate-500 text-sm mb-5">
              {allRequiredUploaded
                ? "All required documents uploaded. You're ready to submit for review."
                : `${missingRequired.length} required document(s) still missing — upload them above before submitting.`}
            </p>
            <button onClick={handleSubmit} disabled={!allRequiredUploaded || submitting}
              className="flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
              style={{ background: allRequiredUploaded ? "linear-gradient(135deg, #f5a623, #e0850d)" : "#e2e8f0", color: allRequiredUploaded ? "#070c1a" : "#94a3b8" }}>
              {submitting && <Spinner />}
              {submitting ? "Submitting…" : "Submit for Review →"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className={`text-sm font-semibold ${gold ? "" : "text-slate-800"}`}
        style={gold ? { color: "#92400e" } : {}}>
        {value}
      </dd>
    </div>
  );
}

function KYCBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    PASSED:  { label: "✓ Passed",  color: "#15803d", bg: "rgba(22,163,74,0.1)" },
    FAILED:  { label: "✕ Failed",  color: "#b91c1c", bg: "rgba(220,38,38,0.1)" },
    PENDING: { label: "⏳ Pending", color: "#d97706", bg: "rgba(217,119,6,0.1)" },
  };
  const m = meta[status] ?? { label: status, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}
