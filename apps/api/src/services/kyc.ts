import axios from "axios";
import { KYCVerificationResult } from "@tradefinance/types";

const DOJAH_BASE = "https://api.dojah.io";
const DOJAH_KEY = process.env.DOJAH_SECRET_KEY!;
const DOJAH_APP_ID = process.env.DOJAH_APP_ID!;

const dojah = axios.create({
  baseURL: DOJAH_BASE,
  headers: {
    Authorization: DOJAH_KEY,
    AppId: DOJAH_APP_ID,
    "Content-Type": "application/json",
  },
});

export async function verifyBVN(
  bvn: string,
  dateOfBirth: string
): Promise<KYCVerificationResult> {
  try {
    const { data } = await dojah.get(`/api/v1/kyc/bvn/full`, {
      params: { bvn },
    });

    const info = data?.entity;
    if (!info) {
      return { status: "FAILED", message: "BVN not found" };
    }

    // Basic DOB cross-check
    const dobMatches =
      info.date_of_birth?.includes(dateOfBirth.split("-")[0]) ?? false;

    return {
      status: dobMatches ? "PASSED" : "FAILED",
      reference: bvn,
      details: info,
      message: dobMatches ? "BVN verified" : "DOB mismatch",
    };
  } catch (err: any) {
    console.error("BVN verification error:", err?.response?.data || err.message);
    return {
      status: "FAILED",
      message: err?.response?.data?.error || "Verification service error",
    };
  }
}

export async function verifyCAC(
  rcNumber: string
): Promise<KYCVerificationResult> {
  try {
    const { data } = await dojah.get(`/api/v1/kyc/cac`, {
      params: { rc_number: rcNumber },
    });

    const entity = data?.entity;
    if (!entity) {
      return { status: "FAILED", message: "CAC number not found" };
    }

    return {
      status: "PASSED",
      reference: rcNumber,
      details: entity,
      message: "CAC registration verified",
    };
  } catch (err: any) {
    console.error("CAC verification error:", err?.response?.data || err.message);
    return {
      status: "FAILED",
      message: err?.response?.data?.error || "CAC verification failed",
    };
  }
}
