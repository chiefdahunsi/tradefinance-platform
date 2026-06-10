"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

const COMMODITIES = [
  "COCOA","CASHEW","SESAME","SOYBEAN","PALM_OIL","GROUNDNUT","COTTON","GINGER","RUBBER","OTHER",
];

const STEPS = ["Business Details", "Trade Profile", "Directors"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [businessId, setBusinessId] = useState("");

  const [business, setBusiness] = useState({
    registeredName: "", tradingName: "", cacNumber: "", taxId: "",
    dateIncorporated: "", businessType: "Limited", sector: "Trading",
    address: "", city: "", state: "Lagos", website: "",
    commodities: [] as string[], yearsInOperation: "", annualTurnover: "",
    exportMarkets: "",
  });

  const [directors, setDirectors] = useState([{
    firstName: "", lastName: "", dateOfBirth: "", bvn: "", nin: "", phone: "",
    email: "", percentOwned: "", isSignatory: true,
  }]);

  const setBiz = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setBusiness((b) => ({ ...b, [field]: e.target.value }));

  const toggleCommodity = (c: string) =>
    setBusiness((b) => ({
      ...b,
      commodities: b.commodities.includes(c)
        ? b.commodities.filter((x) => x !== c)
        : [...b.commodities, c],
    }));

  const setDir = (i: number, field: string) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) =>
    setDirectors((dirs) =>
      dirs.map((d, idx) => (idx === i ? { ...d, [field]: e.target.value } : d))
    );

  const addDirector = () =>
    setDirectors((d) => [
      ...d,
      { firstName: "", lastName: "", dateOfBirth: "", bvn: "", nin: "", phone: "", email: "", percentOwned: "", isSignatory: false },
    ]);

  const buildPayload = () => ({
    ...business,
    yearsInOperation: business.yearsInOperation ? parseInt(business.yearsInOperation) : undefined,
    annualTurnover: business.annualTurnover ? parseFloat(business.annualTurnover) : undefined,
    exportMarkets: business.exportMarkets ? business.exportMarkets.split(",").map((s) => s.trim()) : [],
  });

  const saveBusinessProfile = async () => {
    setLoading(true);
    setError("");
    setFieldErrors({});
    try {
      const { data } = await api.post("/api/business", buildPayload());
      setBusinessId(data.data.id);
      setStep(1);
    } catch (err: any) {
      setFieldErrors(parseFieldErrors(err));
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const saveTradeProfile = async () => {
    if (business.commodities.length === 0) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/api/business", buildPayload());
      setStep(2);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const saveDirectors = async () => {
    setLoading(true);
    setError("");
    try {
      for (let i = 0; i < directors.length; i++) {
        const dir = directors[i];
        if (dir.bvn.length !== 11) {
          setError(`Director ${i + 1}: BVN must be exactly 11 digits.`);
          setLoading(false);
          return;
        }
        if (!dir.firstName || !dir.lastName || !dir.dateOfBirth || !dir.phone || !dir.email || !dir.percentOwned) {
          setError(`Director ${i + 1}: Please fill in all required fields including date of birth.`);
          setLoading(false);
          return;
        }
        await api.post("/api/business/directors", {
          ...dir,
          percentOwned: parseFloat(dir.percentOwned),
        });
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">Complete your business profile</h1>
        <p className="text-slate-500 text-sm">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-1 bg-green-500 transition-all duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Step 0: Business Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Registered Company Name *" error={fieldErrors.registeredName}>
                <input value={business.registeredName} onChange={setBiz("registeredName")} required className={fieldErrors.registeredName ? inputError : input} placeholder="ABC Commodities Ltd" />
              </Field>
              <Field label="Trading Name">
                <input value={business.tradingName} onChange={setBiz("tradingName")} className={input} placeholder="If different" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CAC Number *" error={fieldErrors.cacNumber}>
                <input value={business.cacNumber} onChange={setBiz("cacNumber")} required className={fieldErrors.cacNumber ? inputError : input} placeholder="RC123456" />
              </Field>
              <Field label="Tax ID (TIN)">
                <input value={business.taxId} onChange={setBiz("taxId")} className={input} placeholder="12345678-0001" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business Type *">
                <select value={business.businessType} onChange={setBiz("businessType")} className={input}>
                  <option>Limited</option>
                  <option>Enterprise</option>
                  <option>Partnership</option>
                </select>
              </Field>
              <Field label="Sector *">
                <select value={business.sector} onChange={setBiz("sector")} className={input}>
                  <option>Trading</option>
                  <option>Processing</option>
                  <option>Export</option>
                  <option>Import</option>
                  <option>Aggregation</option>
                </select>
              </Field>
            </div>
            <Field label="Date of Incorporation">
              <input type="date" value={business.dateIncorporated} onChange={setBiz("dateIncorporated")} className={input} />
            </Field>
            <Field label="Registered Address *" error={fieldErrors.address}>
              <input value={business.address} onChange={setBiz("address")} required className={fieldErrors.address ? inputError : input} placeholder="12 Commerce Road" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City *" error={fieldErrors.city}>
                <input value={business.city} onChange={setBiz("city")} required className={fieldErrors.city ? inputError : input} placeholder="Lagos" />
              </Field>
              <Field label="State *">
                <select value={business.state} onChange={setBiz("state")} className={input}>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Website">
              <input type="url" value={business.website} onChange={setBiz("website")} className={input} placeholder="https://yourcompany.com" />
            </Field>
            <button onClick={saveBusinessProfile} disabled={loading} className={btn}>
              {loading && <Spinner />} {loading ? "Saving..." : "Continue →"}
            </button>
          </div>
        )}

        {/* Step 1: Trade Profile */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">
                  Commodities traded *
                </label>
                {business.commodities.length > 0 ? (
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                    {business.commodities.length} selected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Select all that apply</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COMMODITIES.map((c) => {
                  const selected = business.commodities.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCommodity(c)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                        selected
                          ? "bg-green-50 text-green-800 border-green-500"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? "bg-green-500 border-green-500" : "border-slate-300"
                      }`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {c.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
              {business.commodities.length === 0 && (
                <p className="text-xs text-red-500 mt-2">Please select at least one commodity.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Years in Operation">
                <input type="number" min="0" value={business.yearsInOperation} onChange={setBiz("yearsInOperation")} className={input} placeholder="5" />
              </Field>
              <Field label="Annual Turnover (₦)">
                <input type="number" min="0" value={business.annualTurnover} onChange={setBiz("annualTurnover")} className={input} placeholder="50000000" />
              </Field>
            </div>
            <Field label="Export Markets" hint="Comma-separated, e.g. EU, China, India">
              <input value={business.exportMarkets} onChange={setBiz("exportMarkets")} className={input} placeholder="EU, China, India" />
            </Field>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className={btnOutline}>← Back</button>
              <button
                onClick={saveTradeProfile}
                disabled={loading || business.commodities.length === 0}
                className={btn}
              >
                {loading && <Spinner />}{loading ? "Saving..." : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Directors */}
        {step === 2 && (
          <div className="space-y-6">
            {directors.map((dir, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-medium text-slate-900 mb-4">
                  Director {i + 1}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name *">
                      <input value={dir.firstName} onChange={setDir(i, "firstName")} required className={input} placeholder="Chidi" />
                    </Field>
                    <Field label="Last Name *">
                      <input value={dir.lastName} onChange={setDir(i, "lastName")} required className={input} placeholder="Okonkwo" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date of Birth *" hint="Used for BVN verification">
                      <input type="date" value={dir.dateOfBirth} onChange={setDir(i, "dateOfBirth")} required className={input} />
                    </Field>
                    <Field label="NIN">
                      <input value={dir.nin} onChange={setDir(i, "nin")} className={input} placeholder="Optional" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="BVN *" hint="11-digit Bank Verification Number">
                      <input value={dir.bvn} onChange={setDir(i, "bvn")} maxLength={11} required className={input} placeholder="12345678901" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone *">
                      <input value={dir.phone} onChange={setDir(i, "phone")} required className={input} placeholder="08012345678" />
                    </Field>
                    <Field label="Email *">
                      <input type="email" value={dir.email} onChange={setDir(i, "email")} required className={input} placeholder="director@co.com" />
                    </Field>
                  </div>
                  <Field label="% Ownership *">
                    <input type="number" min="0" max="100" value={dir.percentOwned} onChange={setDir(i, "percentOwned")} required className={input} placeholder="51" />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" onClick={addDirector} className={btnOutline}>
              + Add another director
            </button>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className={btnOutline}>← Back</button>
              <button onClick={saveDirectors} disabled={loading} className={btn}>
                {loading && <Spinner />} {loading ? "Saving..." : "Complete Profile →"}
              </button>
            </div>
          </div>
        )}
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
const btnOutline = "border border-slate-200 hover:border-slate-400 text-slate-600 font-medium px-6 py-2.5 rounded-lg transition-colors";
