/**
 * FirstCentral Credit Bureau Integration
 * Docs: https://firstcentralcreditbureau.com/developers
 *
 * Required env vars:
 *   FIRSTCENTRAL_BASE_URL  – e.g. https://api.firstcentralcreditbureau.com
 *   FIRSTCENTRAL_API_KEY   – API key from your FirstCentral dashboard
 *   FIRSTCENTRAL_CLIENT_ID – (optional) some endpoints require a client-id header
 */

const BASE_URL = (process.env.FIRSTCENTRAL_BASE_URL || "").replace(/\/$/, "");
const API_KEY  = process.env.FIRSTCENTRAL_API_KEY || "";
const CLIENT_ID = process.env.FIRSTCENTRAL_CLIENT_ID || "";

export const IS_FIRSTCENTRAL_CONFIGURED =
  BASE_URL.length > 0 && API_KEY.length > 0;

// ─── Response types ────────────────────────────────────────────────────────────

export interface BureauSearchResult {
  configured: boolean;
  found: boolean;
  score: number | null;          // 0–850 scale (FirstCentral)
  scoreRating: string | null;    // e.g. "GOOD", "FAIR", "POOR", "VERY_POOR"
  totalFacilities: number;
  activeFacilities: number;
  closedFacilities: number;
  performingFacilities: number;
  nonPerformingFacilities: number;
  totalOutstanding: number;
  highestArrear: number;
  enquiriesLast12Months: number;
  reference: string | null;
  rawData: Record<string, unknown> | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headers() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
    ...(CLIENT_ID ? { "X-Client-Id": CLIENT_ID } : {}),
  };
}

/** Map FirstCentral score (0–850) → 0–100 for our internal model */
export function normalizeBureauScore(rawScore: number): number {
  return Math.round(Math.min(100, Math.max(0, (rawScore / 850) * 100)));
}

/** Derive a human-readable rating from the raw 0–850 score */
export function scoreRating(raw: number): string {
  if (raw >= 700) return "EXCELLENT";
  if (raw >= 600) return "GOOD";
  if (raw >= 450) return "FAIR";
  if (raw >= 300) return "POOR";
  return "VERY_POOR";
}

// ─── Individual (BVN) lookup ───────────────────────────────────────────────────

/**
 * Perform a credit enquiry using a director's BVN.
 * FirstCentral endpoint: POST /v1/search/individual
 */
export async function lookupByBVN(bvn: string): Promise<BureauSearchResult> {
  if (!IS_FIRSTCENTRAL_CONFIGURED) {
    return {
      configured: false,
      found: false,
      score: null,
      scoreRating: null,
      totalFacilities: 0,
      activeFacilities: 0,
      closedFacilities: 0,
      performingFacilities: 0,
      nonPerformingFacilities: 0,
      totalOutstanding: 0,
      highestArrear: 0,
      enquiriesLast12Months: 0,
      reference: null,
      rawData: null,
      error: "FirstCentral is not configured. Set FIRSTCENTRAL_BASE_URL and FIRSTCENTRAL_API_KEY.",
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/search/individual`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ bvn }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.json() as any;

    if (!res.ok) {
      return {
        configured: true,
        found: false,
        score: null,
        scoreRating: null,
        totalFacilities: 0,
        activeFacilities: 0,
        closedFacilities: 0,
        performingFacilities: 0,
        nonPerformingFacilities: 0,
        totalOutstanding: 0,
        highestArrear: 0,
        enquiriesLast12Months: 0,
        reference: null,
        rawData: body,
        error: body?.message || `FirstCentral returned HTTP ${res.status}`,
      };
    }

    // Normalise the response — FirstCentral returns data under various shapes.
    // We support the two most common: flat and nested under `data` / `result`.
    const data = body?.data ?? body?.result ?? body;
    const summary = data?.creditSummary ?? data?.summary ?? {};
    const scoreRaw: number = data?.creditScore ?? data?.score ?? summary?.creditScore ?? 0;
    const enquiries = data?.enquiries ?? [];
    const last12Months = Array.isArray(enquiries)
      ? enquiries.filter((e: any) => {
          const d = new Date(e.enquiryDate ?? e.date ?? 0);
          return d > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        }).length
      : (summary?.enquiriesLast12Months ?? 0);

    return {
      configured: true,
      found: true,
      score: scoreRaw,
      scoreRating: scoreRating(scoreRaw),
      totalFacilities:       summary?.totalFacilities        ?? summary?.total        ?? 0,
      activeFacilities:      summary?.activeFacilities       ?? summary?.active       ?? 0,
      closedFacilities:      summary?.closedFacilities       ?? summary?.closed       ?? 0,
      performingFacilities:  summary?.performingFacilities   ?? summary?.performing   ?? 0,
      nonPerformingFacilities: summary?.nonPerformingFacilities ?? summary?.nonPerforming ?? 0,
      totalOutstanding:      summary?.totalOutstandingBalance ?? summary?.outstanding  ?? 0,
      highestArrear:         summary?.highestArrear          ?? summary?.arrear        ?? 0,
      enquiriesLast12Months: last12Months,
      reference:             data?.referenceNumber ?? data?.enquiryRef ?? null,
      rawData:               body,
    };
  } catch (err: any) {
    console.error("[FirstCentral] lookupByBVN error:", err?.message ?? err);
    return {
      configured: true,
      found: false,
      score: null,
      scoreRating: null,
      totalFacilities: 0,
      activeFacilities: 0,
      closedFacilities: 0,
      performingFacilities: 0,
      nonPerformingFacilities: 0,
      totalOutstanding: 0,
      highestArrear: 0,
      enquiriesLast12Months: 0,
      reference: null,
      rawData: null,
      error: err?.message ?? "Unexpected error contacting FirstCentral",
    };
  }
}

// ─── Business (RC number) lookup ──────────────────────────────────────────────

/**
 * Perform a corporate credit enquiry using the CAC RC number.
 * FirstCentral endpoint: POST /v1/search/corporate
 */
export async function lookupByCACNumber(rcNumber: string): Promise<BureauSearchResult> {
  if (!IS_FIRSTCENTRAL_CONFIGURED) {
    return {
      configured: false,
      found: false,
      score: null,
      scoreRating: null,
      totalFacilities: 0,
      activeFacilities: 0,
      closedFacilities: 0,
      performingFacilities: 0,
      nonPerformingFacilities: 0,
      totalOutstanding: 0,
      highestArrear: 0,
      enquiriesLast12Months: 0,
      reference: null,
      rawData: null,
      error: "FirstCentral is not configured.",
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/search/corporate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ rcNumber }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.json() as any;
    if (!res.ok) {
      return {
        configured: true, found: false, score: null, scoreRating: null,
        totalFacilities: 0, activeFacilities: 0, closedFacilities: 0,
        performingFacilities: 0, nonPerformingFacilities: 0,
        totalOutstanding: 0, highestArrear: 0, enquiriesLast12Months: 0,
        reference: null, rawData: body,
        error: body?.message || `FirstCentral returned HTTP ${res.status}`,
      };
    }

    const data = body?.data ?? body?.result ?? body;
    const summary = data?.creditSummary ?? data?.summary ?? {};
    const scoreRaw: number = data?.creditScore ?? data?.score ?? summary?.creditScore ?? 0;

    return {
      configured: true,
      found: true,
      score: scoreRaw,
      scoreRating: scoreRating(scoreRaw),
      totalFacilities:       summary?.totalFacilities        ?? 0,
      activeFacilities:      summary?.activeFacilities       ?? 0,
      closedFacilities:      summary?.closedFacilities       ?? 0,
      performingFacilities:  summary?.performingFacilities   ?? 0,
      nonPerformingFacilities: summary?.nonPerformingFacilities ?? 0,
      totalOutstanding:      summary?.totalOutstandingBalance ?? 0,
      highestArrear:         summary?.highestArrear          ?? 0,
      enquiriesLast12Months: summary?.enquiriesLast12Months  ?? 0,
      reference:             data?.referenceNumber ?? null,
      rawData:               body,
    };
  } catch (err: any) {
    console.error("[FirstCentral] lookupByCACNumber error:", err?.message ?? err);
    return {
      configured: true, found: false, score: null, scoreRating: null,
      totalFacilities: 0, activeFacilities: 0, closedFacilities: 0,
      performingFacilities: 0, nonPerformingFacilities: 0,
      totalOutstanding: 0, highestArrear: 0, enquiriesLast12Months: 0,
      reference: null, rawData: null,
      error: err?.message ?? "Unexpected error contacting FirstCentral",
    };
  }
}

// ─── Aggregate bureau score for all directors ─────────────────────────────────

/**
 * Look up all directors' BVNs and return the average normalised score (0-100).
 * Returns null if no valid scores were found.
 */
export async function aggregateDirectorBureauScore(
  directors: { bvn?: string | null; firstName: string; lastName: string }[]
): Promise<{
  aggregatedScore: number | null;
  reference: string | null;
  rawData: Record<string, unknown>;
  details: { name: string; bvn: string; result: BureauSearchResult }[];
}> {
  const validDirectors = directors.filter((d) => d.bvn && d.bvn.length === 11);

  if (validDirectors.length === 0) {
    return { aggregatedScore: null, reference: null, rawData: {}, details: [] };
  }

  const results = await Promise.all(
    validDirectors.map(async (d) => ({
      name: `${d.firstName} ${d.lastName}`,
      bvn: d.bvn!,
      result: await lookupByBVN(d.bvn!),
    }))
  );

  const validScores = results
    .filter((r) => r.result.found && r.result.score !== null)
    .map((r) => normalizeBureauScore(r.result.score!));

  const aggregatedScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;

  const reference = results.find((r) => r.result.reference)?.result.reference ?? null;
  const rawData: Record<string, unknown> = {};
  results.forEach((r) => {
    rawData[r.bvn] = r.result.rawData ?? r.result.error ?? "no_data";
  });

  return { aggregatedScore, reference, rawData, details: results };
}
