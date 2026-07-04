"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

// ─── Appliance catalogue ──────────────────────────────────────────────────────
const APPLIANCE_CATALOGUE = [
  { id: "ac_1hp",       name: "Air Conditioner (1 HP)",        wattage: 746,  category: "Cooling" },
  { id: "ac_1_5hp",     name: "Air Conditioner (1.5 HP)",      wattage: 1119, category: "Cooling" },
  { id: "ac_2hp",       name: "Air Conditioner (2 HP)",        wattage: 1492, category: "Cooling" },
  { id: "ceiling_fan",  name: "Ceiling Fan",                   wattage: 75,   category: "Cooling" },
  { id: "stand_fan",    name: "Standing Fan",                  wattage: 60,   category: "Cooling" },
  { id: "refrigerator", name: "Refrigerator",                  wattage: 150,  category: "Kitchen" },
  { id: "freezer",      name: "Chest Freezer",                 wattage: 200,  category: "Kitchen" },
  { id: "microwave",    name: "Microwave Oven",                wattage: 1200, category: "Kitchen" },
  { id: "kettle",       name: "Electric Kettle",               wattage: 2000, category: "Kitchen" },
  { id: "washing_machine", name: "Washing Machine",            wattage: 500,  category: "Kitchen" },
  { id: "led_bulb",     name: "LED Bulb",                      wattage: 10,   category: "Lighting" },
  { id: "fluorescent",  name: "Fluorescent Tube",              wattage: 36,   category: "Lighting" },
  { id: "tv_32",        name: 'TV (32")',                      wattage: 60,   category: "Electronics" },
  { id: "tv_43",        name: 'TV (43" and above)',            wattage: 120,  category: "Electronics" },
  { id: "desktop_pc",   name: "Desktop Computer",              wattage: 200,  category: "Electronics" },
  { id: "laptop",       name: "Laptop",                        wattage: 65,   category: "Electronics" },
  { id: "printer",      name: "Printer / Copier",              wattage: 400,  category: "Electronics" },
  { id: "router",       name: "Router / Modem",                wattage: 15,   category: "Electronics" },
  { id: "water_pump",   name: "Water Pump (0.5 HP)",           wattage: 375,  category: "Machinery" },
  { id: "borehole",     name: "Borehole Pump (1 HP)",          wattage: 746,  category: "Machinery" },
  { id: "cctv",         name: "CCTV Camera (per camera)",      wattage: 15,   category: "Security" },
  { id: "cctv_dvr",     name: "CCTV DVR / NVR",               wattage: 30,   category: "Security" },
  { id: "iron",         name: "Pressing Iron",                 wattage: 1000, category: "Others" },
  { id: "industrial",   name: "Industrial Machine (small)",    wattage: 3000, category: "Others" },
];

const CATEGORIES = Array.from(new Set(APPLIANCE_CATALOGUE.map((a) => a.category)));

interface ApplianceRow {
  key: string;
  id: string;
  name: string;
  wattage: number;
  quantity: number;
  hoursPerDay: number;
  custom?: boolean;
}

const SYSTEM_TYPES = [
  { value: "RESIDENTIAL",    label: "Residential",    desc: "Home / apartment" },
  { value: "COMMERCIAL",     label: "Commercial",     desc: "Office, retail, mixed-use" },
  { value: "INDUSTRIAL",     label: "Industrial",     desc: "Factory, warehouse" },
  { value: "AGRO_PROCESSING",label: "Agro-Processing",desc: "Farm, mill, cold storage" },
  { value: "HEALTHCARE",     label: "Healthcare",     desc: "Clinic, hospital, pharmacy" },
  { value: "EDUCATION",      label: "Education",      desc: "School, university" },
  { value: "OTHER",          label: "Other",          desc: "Any other installation" },
];

// ─── Estimation helpers ───────────────────────────────────────────────────────
function estimate(rows: ApplianceRow[]) {
  const peakLoadW  = rows.reduce((s, r) => s + r.wattage * r.quantity, 0);
  const dailyKwh   = rows.reduce((s, r) => s + (r.wattage * r.quantity * r.hoursPerDay) / 1000, 0);
  // Nigeria avg peak sun hours ≈ 4.5h, system efficiency ≈ 80%
  const systemKwp  = dailyKwh / (4.5 * 0.8);
  return { peakLoadKw: peakLoadW / 1000, dailyKwh, systemKwp };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const router  = useRouter();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    amountRequested: "",
    tenor: "36",
    purpose: "",
    systemType: "COMMERCIAL",
    projectAddress: "",
    projectDescription: "",
    collateralType: "",
    collateralValue: "",
    collateralDetails: "",
  });

  // Appliance rows
  const [appliances, setAppliances] = useState<ApplianceRow[]>([]);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Custom appliance
  const [customName, setCustomName]     = useState("");
  const [customWattage, setCustomWattage] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addFromCatalogue = (cat: typeof APPLIANCE_CATALOGUE[number]) => {
    setAppliances((prev) => {
      const existing = prev.find((r) => r.id === cat.id);
      if (existing) {
        return prev.map((r) => r.id === cat.id ? { ...r, quantity: r.quantity + 1 } : r);
      }
      return [...prev, { key: cat.id, id: cat.id, name: cat.name, wattage: cat.wattage, quantity: 1, hoursPerDay: 8 }];
    });
  };

  const addCustomAppliance = () => {
    if (!customName || !customWattage) return;
    const key = `custom_${Date.now()}`;
    setAppliances((prev) => [...prev, {
      key, id: key, name: customName, wattage: parseFloat(customWattage),
      quantity: 1, hoursPerDay: 8, custom: true,
    }]);
    setCustomName(""); setCustomWattage(""); setAddingCustom(false);
  };

  const updateRow = (key: string, field: "quantity" | "hoursPerDay", value: number) =>
    setAppliances((prev) => prev.map((r) => r.key === key ? { ...r, [field]: Math.max(field === "quantity" ? 1 : 0.5, value) } : r));

  const removeRow = (key: string) =>
    setAppliances((prev) => prev.filter((r) => r.key !== key));

  const est = estimate(appliances);

  const filteredCatalogue = APPLIANCE_CATALOGUE.filter((a) => {
    const matchCat = activeCategory === "All" || a.category === activeCategory;
    const matchSearch = a.name.toLowerCase().includes(catalogueSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appliances.length === 0) {
      setError("Please add at least one appliance to estimate your power load.");
      return;
    }
    setError(""); setFieldErrors({}); setLoading(true);
    try {
      const payload = {
        ...form,
        amountRequested: parseFloat(form.amountRequested),
        tenor: parseInt(form.tenor),
        systemSizeKwp: parseFloat(est.systemKwp.toFixed(2)),
        collateralValue: form.collateralValue ? parseFloat(form.collateralValue) : undefined,
        appliances: appliances.map(({ key: _k, custom: _c, ...rest }) => rest),
      };
      const { data } = await api.post("/api/applications", payload);
      router.push(`/dashboard/applications/${data.data.id}`);
    } catch (err: any) {
      setFieldErrors(parseFieldErrors(err));
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      <header className="bg-white border-b border-slate-100 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4 h-16">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 transition-colors">←</button>
          <div>
            <h1 className="font-display font-bold text-slate-900">New Solar Finance Application</h1>
            <p className="text-slate-500 text-xs">Build your appliance list · we estimate your system size</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Installation Type ── */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-4">Installation Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {SYSTEM_TYPES.map((t) => (
                <button key={t.value} type="button"
                  onClick={() => setForm((f) => ({ ...f, systemType: t.value }))}
                  className="text-left p-4 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.systemType === t.value ? "#f5a623" : "#e2e8f0",
                    background: form.systemType === t.value ? "rgba(245,166,35,0.06)" : "white",
                  }}>
                  <p className="text-sm font-semibold" style={{ color: form.systemType === t.value ? "#92400e" : "#1e293b" }}>{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ── Appliance Load Builder ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-50">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display font-semibold text-slate-900">Appliances to Power</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Add what you want to run on solar — we&apos;ll estimate your system size automatically.
                  </p>
                </div>
                {appliances.length > 0 && (
                  <button type="button" onClick={() => setShowCatalogue(true)}
                    className="shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-lg ml-4"
                    style={{ background: "rgba(245,166,35,0.1)", color: "#92400e" }}>
                    + Add more
                  </button>
                )}
              </div>
            </div>

            {/* Empty state */}
            {appliances.length === 0 && (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-xl"
                  style={{ background: "rgba(245,166,35,0.08)" }}>⚡</div>
                <p className="text-sm font-medium text-slate-600 mb-1">No appliances added yet</p>
                <p className="text-xs text-slate-400 mb-4">Pick from common appliances or enter a custom one</p>
                <div className="flex gap-2 justify-center">
                  <button type="button" onClick={() => setShowCatalogue(true)}
                    className="text-sm font-semibold px-4 py-2 rounded-xl text-white"
                    style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                    Browse Appliances
                  </button>
                  <button type="button" onClick={() => setAddingCustom(true)}
                    className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300">
                    Custom Appliance
                  </button>
                </div>
              </div>
            )}

            {/* Appliance rows */}
            {appliances.length > 0 && (
              <div className="divide-y divide-slate-50">
                {/* Header */}
                <div className="grid px-6 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                  style={{ gridTemplateColumns: "1fr 80px 100px 60px 24px" }}>
                  <span>Appliance</span>
                  <span className="text-center">Qty</span>
                  <span className="text-center">Hrs / day</span>
                  <span className="text-right">Load</span>
                  <span />
                </div>
                {appliances.map((row) => (
                  <div key={row.key} className="grid items-center px-6 py-3 gap-2"
                    style={{ gridTemplateColumns: "1fr 80px 100px 60px 24px" }}>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{row.name}</p>
                      <p className="text-xs text-slate-400">{row.wattage}W each</p>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => updateRow(row.key, "quantity", row.quantity - 1)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 text-xs hover:border-slate-400 transition-colors">−</button>
                      <span className="text-sm font-semibold text-slate-700 w-5 text-center">{row.quantity}</span>
                      <button type="button" onClick={() => updateRow(row.key, "quantity", row.quantity + 1)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 text-xs hover:border-slate-400 transition-colors">+</button>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => updateRow(row.key, "hoursPerDay", row.hoursPerDay - 0.5)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 text-xs hover:border-slate-400 transition-colors">−</button>
                      <span className="text-sm font-semibold text-slate-700 w-8 text-center">{row.hoursPerDay}h</span>
                      <button type="button" onClick={() => updateRow(row.key, "hoursPerDay", row.hoursPerDay + 0.5)}
                        className="w-6 h-6 rounded-md border border-slate-200 text-slate-500 text-xs hover:border-slate-400 transition-colors">+</button>
                    </div>
                    <p className="text-xs text-right font-medium text-slate-500">
                      {((row.wattage * row.quantity) / 1000).toFixed(2)} kW
                    </p>
                    <button type="button" onClick={() => removeRow(row.key)}
                      className="text-slate-300 hover:text-red-400 transition-colors text-sm leading-none">×</button>
                  </div>
                ))}

                {/* Add more row */}
                <div className="px-6 py-3 flex gap-2">
                  <button type="button" onClick={() => setShowCatalogue(true)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    + Add appliance
                  </button>
                  <span className="text-slate-200">·</span>
                  <button type="button" onClick={() => setAddingCustom(true)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    + Custom
                  </button>
                </div>
              </div>
            )}

            {/* Custom appliance form */}
            {addingCustom && (
              <div className="px-6 pb-5 border-t border-slate-50 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Custom Appliance</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Name</label>
                    <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                      className={inp} placeholder="e.g. Industrial Blender" />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-slate-500 mb-1 block">Wattage (W)</label>
                    <input type="number" value={customWattage} onChange={(e) => setCustomWattage(e.target.value)}
                      className={inp} placeholder="2000" />
                  </div>
                  <button type="button" onClick={addCustomAppliance}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                    Add
                  </button>
                  <button type="button" onClick={() => setAddingCustom(false)}
                    className="text-sm text-slate-400 hover:text-slate-600 px-2 py-2.5 shrink-0">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Estimate summary */}
            {appliances.length > 0 && (
              <div className="mx-6 mb-6 rounded-xl p-4"
                style={{ background: "linear-gradient(135deg, #070c1a 0%, #0d1f3c 100%)" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#f5a623" }}>
                  Estimated Power Profile
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Peak Load", value: `${est.peakLoadKw.toFixed(2)} kW`, hint: "Total simultaneous draw" },
                    { label: "Daily Energy", value: `${est.dailyKwh.toFixed(1)} kWh/day`, hint: "At configured hours" },
                    { label: "Recommended System", value: `${est.systemKwp.toFixed(1)} kWp`, hint: "Solar panel capacity" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="font-display font-bold text-white text-lg leading-tight">{s.value}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: "#f5a623" }}>{s.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.hint}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  Based on Nigeria avg. 4.5 peak sun hours/day · 80% system efficiency · an installer will confirm final sizing.
                </p>
              </div>
            )}
          </section>

          {/* ── Facility Details ── */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-5">Facility Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount Requested (₦) *" error={fieldErrors.amountRequested}>
                  <input type="number" min="100000" required value={form.amountRequested}
                    onChange={set("amountRequested")} className={fieldErrors.amountRequested ? inpError : inp}
                    placeholder="5,000,000" />
                </Field>
                <Field label="Repayment Tenor *">
                  <select value={form.tenor} onChange={set("tenor")} className={inp}>
                    {[6, 12, 18, 24, 36].map((t) => (
                      <option key={t} value={t}>{t} months ({Math.round(t / 12 * 10) / 10} yr{t >= 24 ? "s" : ""})</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Installation Address">
                <input value={form.projectAddress} onChange={set("projectAddress")} className={inp}
                  placeholder="Address where panels will be installed" />
              </Field>
              <Field label="Purpose of Facility *" error={fieldErrors.purpose}>
                <input required value={form.purpose} onChange={set("purpose")}
                  className={fieldErrors.purpose ? inpError : inp}
                  placeholder="e.g. Solar installation to eliminate generator dependency and cut energy costs" />
              </Field>
              <Field label="Project Description *"
                hint="Describe your current energy situation, expected savings, and any preferred installer"
                error={fieldErrors.projectDescription}>
                <textarea required rows={4} value={form.projectDescription}
                  onChange={set("projectDescription")}
                  className={`${fieldErrors.projectDescription ? inpError : inp} resize-none`}
                  placeholder="We currently spend ₦800,000/month on diesel. A solar system will eliminate generator costs within 18 months…" />
              </Field>
            </div>
          </section>

          {/* ── Collateral ── */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-display font-semibold text-slate-900 mb-1">Collateral</h2>
            <p className="text-slate-400 text-xs mb-5">Optional — significantly improves your credit score</p>
            <div className="space-y-4">
              <Field label="Collateral Type">
                <select value={form.collateralType} onChange={set("collateralType")} className={inp}>
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
                      className={inp} placeholder="10,000,000" />
                  </Field>
                  <Field label="Collateral Details"
                    hint="Location, condition, proof of ownership — documents can be uploaded on the next screen">
                    <textarea rows={3} value={form.collateralDetails} onChange={set("collateralDetails")}
                      className={`${inp} resize-none`}
                      placeholder="Describe the collateral — location, condition, ownership details" />
                  </Field>
                </>
              )}
            </div>
          </section>

          <button type="submit" disabled={loading || appliances.length === 0}
            className="w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 text-white"
            style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
            {loading && <Spinner />}
            {loading ? "Creating…" : "Create Application & Upload Documents →"}
          </button>
        </form>
      </main>

      {/* ── Catalogue modal ── */}
      {showCatalogue && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(7,12,26,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCatalogue(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-bold text-slate-900">Add Appliance</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select to add; quantity adjustable on the main form</p>
              </div>
              <button type="button" onClick={() => setShowCatalogue(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors text-lg">
                ×
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-50 shrink-0">
              <input value={catalogueSearch} onChange={(e) => setCatalogueSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none bg-slate-50"
                placeholder="Search appliances…" />
            </div>

            {/* Category tabs */}
            <div className="px-5 py-2 flex gap-2 overflow-x-auto border-b border-slate-50 shrink-0">
              {["All", ...CATEGORIES].map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={activeCategory === cat
                    ? { background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }
                    : { background: "#f1f5f9", color: "#64748b" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Appliance list */}
            <div className="overflow-y-auto flex-1 px-3 py-3">
              {filteredCatalogue.map((cat) => {
                const existing = appliances.find((r) => r.id === cat.id);
                return (
                  <button key={cat.id} type="button" onClick={() => addFromCatalogue(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{cat.name}</p>
                      <p className="text-xs text-slate-400">{cat.wattage}W · {cat.category}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {existing && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(245,166,35,0.15)", color: "#92400e" }}>
                          ×{existing.quantity}
                        </span>
                      )}
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: existing ? "rgba(245,166,35,0.15)" : "#f1f5f9", color: existing ? "#92400e" : "#64748b" }}>
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowCatalogue(false)}
                className="w-full font-semibold py-2.5 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
                Done ({appliances.length} appliance{appliances.length !== 1 ? "s" : ""} added)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inp = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors";
const inpError = "w-full border border-red-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white";
