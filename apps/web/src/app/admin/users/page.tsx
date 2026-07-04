"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/layout/admin-shell";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
  business?: { registeredName: string; cacNumber: string } | null;
  _count: { analystReviews: number };
}

const ROLES = ["ALL", "SME_OWNER", "ANALYST", "ADMIN"];

const ROLE_STYLES: Record<string, string> = {
  SME_OWNER: "bg-blue-950 text-blue-300 border-blue-800",
  ANALYST: "bg-purple-950 text-purple-300 border-purple-800",
  ADMIN: "bg-amber-950 text-amber-300 border-amber-800",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showProvision, setShowProvision] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    role: "ANALYST" as "ANALYST" | "ADMIN",
    password: "", confirmPassword: "",
  });
  const [formError, setFormError] = useState("");
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [provisioning, setProvisioning] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState("");

  const fetchUsers = (role: string) => {
    setLoading(true);
    const query = role !== "ALL" ? `?role=${role}` : "";
    api.get(`/api/admin/users${query}`)
      .then((r) => setUsers(r.data.data))
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(roleFilter); }, [roleFilter]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormFieldErrors({});
    setProvisionSuccess("");

    if (form.password !== form.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setProvisioning(true);
    try {
      await api.post("/api/admin/users", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        password: form.password,
      });
      setProvisionSuccess(`${form.role === "ADMIN" ? "Admin" : "Analyst"} account created for ${form.email}.`);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "ANALYST", password: "", confirmPassword: "" });
      fetchUsers(roleFilter);
    } catch (err: any) {
      setFormFieldErrors(parseFieldErrors(err));
      setFormError(parseApiError(err));
    } finally {
      setProvisioning(false);
    }
  };

  const updateRole = async (userId: string, role: string) => {
    setUpdatingRole(userId);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      fetchUsers(roleFilter);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setUpdatingRole(null);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <AdminShell>
      <div className="px-8 py-7 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-white">Users</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Manage platform users and provision new accounts</p>
          </div>
          <button
            onClick={() => { setShowProvision(!showProvision); setFormError(""); setProvisionSuccess(""); }}
            className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {showProvision ? "✕ Cancel" : "+ Provision Account"}
          </button>
        </div>

        {error && (
          <div className="mb-5 bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Provision form */}
        {showProvision && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 mb-6">
            <h2 className="font-display text-sm font-semibold text-white mb-4">Provision New Account</h2>

            {provisionSuccess && (
              <div className="mb-4 bg-green-950/50 border border-green-800 text-green-300 text-sm px-4 py-3 rounded-lg">
                ✓ {provisionSuccess}
              </div>
            )}
            {formError && (
              <div className="mb-4 bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name *" error={formFieldErrors.firstName}>
                  <input value={form.firstName} onChange={set("firstName")} required className={formFieldErrors.firstName ? inputErr : input} placeholder="Emeka" />
                </Field>
                <Field label="Last Name *" error={formFieldErrors.lastName}>
                  <input value={form.lastName} onChange={set("lastName")} required className={formFieldErrors.lastName ? inputErr : input} placeholder="Eze" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email *" error={formFieldErrors.email}>
                  <input type="email" value={form.email} onChange={set("email")} required className={formFieldErrors.email ? inputErr : input} placeholder="analyst@company.com" />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={set("phone")} className={input} placeholder="08012345678" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Role *">
                  <select value={form.role} onChange={set("role")} className={input}>
                    <option value="ANALYST">Analyst</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </Field>
                <Field label="Password *" error={formFieldErrors.password}>
                  <input type="password" value={form.password} onChange={set("password")} required minLength={8} className={formFieldErrors.password ? inputErr : input} placeholder="Min. 8 characters" />
                </Field>
                <Field label="Confirm Password">
                  <input
                    type="password" value={form.confirmPassword}
                    onChange={set("confirmPassword")} required
                    className={`${input} ${form.confirmPassword && form.password !== form.confirmPassword ? "border-red-700" : ""}`}
                    placeholder="••••••••"
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit" disabled={provisioning}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {provisioning && <Spinner className="text-zinc-600" />}
                  {provisioning ? "Creating..." : "Create Account →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Role filter */}
        <div className="flex gap-1.5 mb-5">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === r
                  ? "bg-white text-zinc-900"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Users table */}
        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : users.length === 0 ? (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-12 text-center text-zinc-500">
            No users found.
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800">
                <tr>
                  {["Name", "Email", "Role", "Business", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{user.firstName} {user.lastName}</p>
                      {user.phone && <p className="text-xs text-zinc-500">{user.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_STYLES[user.role] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {user.business ? (
                        <div>
                          <p className="text-zinc-300">{user.business.registeredName}</p>
                          <p className="text-zinc-500">{user.business.cacNumber}</p>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {updatingRole === user.id ? (
                        <Spinner className="text-zinc-400 w-4 h-4" />
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        >
                          <option value="SME_OWNER">SME Owner</option>
                          <option value="ANALYST">Analyst</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const input = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-transparent";
const inputErr = "w-full bg-zinc-800 border border-red-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
