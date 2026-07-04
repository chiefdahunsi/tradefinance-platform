"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

const SYSTEM_TYPES = [
  { value: "RESIDENTIAL", label: "Residential", desc: "Home / apartment solar installation" },
  { value: "COMMERCIAL", label: "Commercial", desc: "Office, retail, or mixed-use building" },
  { value: "INDUSTRIAL", label: "Industrial", desc: "Factory, warehouse, or manufacturing plant" },
  { value: "AGRO_PROCESSING", label: "Agro-Processing", desc: "Farm, processing mill, or cold storage" },
  { value: "HEALTHCARE", label: "Healthcare", desc: "Clinic, hospital, or pharmacy" },
  { value: "EDUCATION", label: "Education", desc: "School, university, or training centre" },
  { value: "OTHER", label: "Other", desc: "Any other installation type" },
];

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const quoteRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    amountRequested: "",
    tenor: "36",
    purpose: "",
    systemType: "COMMERCIAL",
    systemSizeKwp: "",
    projectAddress: "",
    projectDescription: "",
    collateralType: "",
    collateralValue: "",
    collateralDetails: "",
  });

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const payload = {
        ...form,
        amountRequested: parseFloat(form.amountRequested),
        tenor: parseInt(form.tenor),
        systemSizeKwp: form.systemSizeKwp ? parseFloat(form.systemSizeKwp) : undefined,
        collateralValue: form.collateralValue ? parseFloat(form.collateralValue) : undefined,
      };
      const { data } = await api.post("/api/applications", payload);
      const applicationId = data.data.id;

      if (quoteFile) {
        const formData = new FormData();
        formData.append("file", quoteFile);
        formData.append("documentType", "INSTALLATION_QUOTE");
        await api.post(`/api/documents/${applicationId}`, formData);
      }

      router.push(`/dashboard/applications/${applicationId}`);
    } catch (err: any) {
      setFieldErrors(parseFieldErrors(err));
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">←</button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">New Solar Finance Application</h1>
          <p className="text-slate-500 text-sm">Finance your solar installation</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* System Type */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Installation Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {SYSTEM_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, systemType: t.value }))}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    form.systemType === t.value
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className={`text-sm font-semibold ${form.systemType === t.value ? "text-green-800" : "text-slate-800"}`}>{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Facility Details */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Facility Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount Requested (₦) *" error={fieldErrors.amountRequested}>
                  <input
                    type="number" min="100000" required
                    value={form.amountRequested} onChange={set("amountRequested")}
                    className={fieldErrors.amountRequested ? inputError : input}
                    placeholder="5,000,000"
                  />
                </Field>
                <Field label="Repayment Tenor *" error={fieldErrors.tenor}>
                  <select value={form.tenor} onChange={set("tenor")} className={input}>
                    {[6,12,18,24,36].map((t) => (
                      <option key={t} value={t}>{t} months ({Math.round(t/12 * 10) / 10} yr{t >= 24 ? "s" : ""})</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="System Size (kWp)" hint="Estimated peak capacity in kilowatts">
                  <input
                    type="number" min="0.5" step="0.5"
                    value={form.systemSizeKwp} onChange={set("systemSizeKwp")}
                    className={input} placeholder="e.g. 20"
                  />
                </Field>
                <Field label="Installation Address">
                  <input
                    value={form.projectAddress} onChange={set("projectAddress")}
                    className={input} placeholder="Where the panels will be installed"
                  />
                </Field>
              </div>
              <Field label="Purpose of Facility *" error={fieldErrors.purpose}>
                <input
                  required value={form.purpose}
                  onChange={(e) => { set("purpose")(e); setFieldErrors((f) => ({ ...f, purpose: "" })); }}
                  className={fieldErrors.purpose ? inputError : input}
                  placeholder="e.g. Solar installation to eliminate NEPA dependency and reduce energy costs"
                />
              </Field>
              <Field
                label="Project Description *"
                hint="Describe the project — current energy situation, proposed system, expected savings, and installer details"
                error={fieldErrors.projectDescription}
              >
                <textarea
                  required rows={4} value={form.projectDescription}
                  onChange={(e) => { set("projectDescription")(e); setFieldErrors((f) => ({ ...f, projectDescription: "" })); }}
                  className={`${fieldErrors.projectDescription ? inputError : input} resize-none`}
                  placeholder="We currently spend ₦800,000/month on diesel generators. A 50 kWp solar system with 100 kWh battery backup will eliminate generator costs within 18 months. Installation by SolarMax Nigeria Ltd."
                />
              </Field>
            </div>
          </section>

          {/* Installer Quote Upload */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Installer Quotation</h2>
            <p className="text-slate-500 text-sm mb-5">
              Optional — upload now or later. PDF, JPG or PNG · Max 10MB.
            </p>
            <input ref={quoteRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => setQuoteFile(e.target.files?.[0] ?? null)} />
            {quoteFile ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <span>📄</span>
                  <span className="font-medium">{quoteFile.name}</span>
                  <span className="text-green-600">({(quoteFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button type="button"
                  onClick={() => { setQuoteFile(null); if (quoteRef.current) quoteRef.current.value = ""; }}
                  className="text-green-600 hover:text-red-500 text-sm font-medium">
                  Remove
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => quoteRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 hover:border-green-400 rounded-lg py-6 text-sm text-slate-400 hover:text-green-600 transition-colors">
                Click to upload installer quotation
              </button>
            )}
          </section>

          {/* Collateral */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Collateral</h2>
            <p className="text-slate-500 text-sm mb-5">Optional but significantly improves your credit score</p>
            <div className="space-y-4">
              <Field label="Collateral Type">
                <select value={form.collateralType} onChange={set("collateralType")} className={input}>
                  <option value="">None / Not applicable</option>
                  <option>Real Estate</option>
                  <option>Domiciliation of Sales</option>
                  <option>Equipment</option>
                  <option>Stock / Inventory</option>
                  <option>Letter of Credit</option>
                  <option>Other</option>
                </select>
              </Field>
              {form.collateralType && (
                <>
                  <Field label="Estimated Value (₦)">
                    <input type="number" min="0" value={form.collateralValue} onChange={set("collateralValue")}
                      className={input} placeholder="10,000,000" />
                  </Field>
                  <Field label="Collateral Details">
                    <textarea rows={3} value={form.collateralDetails} onChange={set("collateralDetails")}
                      className={`${input} resize-none`}
                      placeholder="Describe the collateral — location, condition, ownership details" />
                  </Field>
                </>
              )}
            </div>
          </section>

          <button type="submit" disabled={loading} className={btn}>
            {loading && <Spinner />}
            {loading ? "Creating..." : "Create Application & Upload Documents →"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const input = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";
const inputError = "w-full border border-red-400 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white";
const btn = "flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors";
