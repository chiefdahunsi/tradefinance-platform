import axios from "axios";
import { KYCVerificationResult } from "@tradefinance/types";

const DOJAH_CONFIGURED =
  !!process.env.DOJAH_SECRET_KEY &&
  !!process.env.DOJAH_APP_ID &&
  process.env.DOJAH_SECRET_KEY !== "" &&
  process.env.DOJAH_APP_ID !== "";

const dojah = axios.create({
  baseURL: "https://api.dojah.io",
  headers: {
    Authorization: process.env.DOJAH_SECRET_KEY,
    AppId: process.env.DOJAH_APP_ID,
    "Content-Type": "application/json",
  },
});

export function isKYCConfigured() {
  return DOJAH_CONFIGURED;
}

export async function verifyBVN(
  bvn: string,
  dateOfBirth: string
): Promise<KYCVerificationResult> {
  if (!DOJAH_CONFIGURED) {
    return {
      status: "PENDING",
      reference: bvn,
      message: "KYC provider not configured. Add DOJAH_SECRET_KEY and DOJAH_APP_ID to .env to enable live verification.",
    };
  }

  try {
    const { data } = await dojah.get(`/api/v1/kyc/bvn/full`, {
      params: { bvn },
    });

    const info = data?.entity;
    if (!info) {
      return { status: "FAILED", reference: bvn, message: "BVN not found in registry" };
    }

    // Cross-check year of birth from the provided date
    const providedYear = dateOfBirth?.split("-")[0];
    const dobMatches = providedYear
      ? info.date_of_birth?.includes(providedYear)
      : true;

    return {
      status: dobMatches ? "PASSED" : "FAILED",
      reference: bvn,
      details: info,
      message: dobMatches
        ? "BVN verified successfully"
        : "Date of birth does not match BVN records",
    };
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.response?.data?.message || "BVN verification service error";
    console.error("BVN verification error:", err?.response?.data || err.message);
    return { status: "FAILED", reference: bvn, message: msg };
  }
}

export async function verifyCAC(
  rcNumber: string,
  companyName: string
): Promise<KYCVerificationResult> {
  if (!DOJAH_CONFIGURED) {
    return {
      status: "PENDING",
      reference: rcNumber,
      message: "KYC provider not configured. Add DOJAH_SECRET_KEY and DOJAH_APP_ID to .env to enable live verification.",
    };
  }

  // Try advance endpoint first (rc_number only), always fall back to basic with company_name
  const endpoints = [
    { url: `/api/v1/kyc/cac/advance`, params: { rc_number: rcNumber } },
    { url: `/api/v1/kyc/cac`,         params: { rc_number: rcNumber, company_name: companyName } },
  ];

  let lastError = "";

  for (const endpoint of endpoints) {
    try {
      const { data } = await dojah.get(endpoint.url, { params: endpoint.params });
      console.log(`CAC [${endpoint.url}] response:`, JSON.stringify(data).slice(0, 300));

      const entity = data?.entity;
      if (!entity) {
        return { status: "FAILED", reference: rcNumber, message: "CAC number not found in registry" };
      }

      return {
        status: "PASSED",
        reference: rcNumber,
        details: entity,
        message: "CAC registration verified successfully",
      };
    } catch (err: any) {
      const errData = err?.response?.data;
      console.error(`CAC [${endpoint.url}] failed (${err?.response?.status}):`, JSON.stringify(errData || err.message).slice(0, 300));

      // Extract the most useful error message
      lastError = errData?.error ||
        errData?.message ||
        Object.entries(errData || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ") ||
        err.message ||
        "CAC verification failed";

      // Always continue to next endpoint — don't break early
      continue;
    }
  }

  return { status: "FAILED", reference: rcNumber, message: lastError };
}
