import { spawn } from "child_process";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { Readable } from "stream";
import Anthropic from "@anthropic-ai/sdk";
import { Document } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DocumentInsights {
  auditedFinancials: {
    annualRevenue: number | null;
    netProfit: number | null;
    totalAssets: number | null;
    totalLiabilities: number | null;
    profitMargin: number | null;
    goingConcernIssue: boolean;
    auditorQualified: boolean;
    flags: string[];
  } | null;
  bankStatement: {
    averageMonthlyBalance: number | null;
    totalCreditTurnover12m: number | null;
    hasLoansOrOverdrafts: boolean;
    irregularities: string[];
  } | null;
  electricityBill: {
    averageMonthlyAmount: number | null;
  } | null;
  siteAssessment: {
    recommendedSystemSizeKwp: number | null;
    siteViable: boolean | null;
    notes: string[];
  } | null;
  installationQuote: {
    totalQuoteAmount: number | null;
    installerName: string | null;
    systemSizeKwp: number | null;
  } | null;
  generalFlags: string[];
  documentsSummarized: string[];
}

// ── Convert a file buffer to Markdown via markitdown ─────────────────────────

async function toMarkdown(buffer: Buffer, ext: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `${uuid()}${ext}`);
  fs.writeFileSync(tmpFile, buffer);

  return new Promise<string>((resolve) => {
    let out = "";
    let errOut = "";
    const proc = spawn("python3", ["-m", "markitdown", tmpFile]);
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", () => {
      fs.unlink(tmpFile, () => {});
      resolve(out.trim() || `[No text extracted: ${errOut.trim() || "empty output"}]`);
    });
    proc.on("error", () => {
      fs.unlink(tmpFile, () => {});
      resolve("[markitdown unavailable in this environment]");
    });
  });
}

// ── Fetch file bytes from S3 or local filesystem ─────────────────────────────

async function fetchFileBuffer(
  doc: Document,
  s3: S3Client | null,
  bucket: string,
): Promise<Buffer> {
  if (s3 && doc.fileUrl.startsWith("s3://")) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: doc.fileKey }));
    const chunks: Buffer[] = [];
    for await (const chunk of obj.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return fs.readFileSync(path.join(process.cwd(), doc.fileUrl));
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function analyseDocuments(
  documents: Document[],
  s3: S3Client | null,
  bucket: string,
): Promise<DocumentInsights> {
  if (documents.length === 0) {
    return emptyInsights(["No documents uploaded"]);
  }

  // Convert all documents to Markdown sections concurrently
  const sections = await Promise.all(
    documents.map(async (doc) => {
      try {
        const buffer = await fetchFileBuffer(doc, s3, bucket);
        const ext = path.extname(doc.fileName) || ".pdf";
        const md = await toMarkdown(buffer, ext);
        return {
          type: doc.type,
          label: `${doc.type.replace(/_/g, " ")} — ${doc.fileName}`,
          markdown: md,
        };
      } catch (err: any) {
        return {
          type: doc.type,
          label: `${doc.type.replace(/_/g, " ")} — ${doc.fileName}`,
          markdown: `[Failed to read: ${err?.message ?? "unknown error"}]`,
        };
      }
    })
  );

  const docsContext = sections
    .map((s) => `### ${s.label}\n\n${s.markdown}`)
    .join("\n\n---\n\n");

  const documentsSummarized = sections.map((s) => s.type);

  // ── Call Claude to extract structured financial indicators ────────────────
  const systemPrompt = `You are a credit analyst assistant. You will be given the text content of financial and business documents that have been converted from PDF/DOCX to Markdown. Your task is to extract key financial indicators and flag any concerns.

Extract ONLY values that are explicitly present in the documents. Do NOT infer, estimate, or fabricate numbers. Use null when a value is not found.

All monetary values should be in Nigerian Naira (NGN) as plain numbers (no symbols or commas).`;

  const userPrompt = `Below are the documents submitted for a Nigerian solar finance application. Extract the financial indicators and return ONLY a JSON object matching this exact schema (no extra keys, no markdown fences):

{
  "auditedFinancials": {
    "annualRevenue": number | null,
    "netProfit": number | null,
    "totalAssets": number | null,
    "totalLiabilities": number | null,
    "profitMargin": number | null,
    "goingConcernIssue": boolean,
    "auditorQualified": boolean,
    "flags": string[]
  } | null,
  "bankStatement": {
    "averageMonthlyBalance": number | null,
    "totalCreditTurnover12m": number | null,
    "hasLoansOrOverdrafts": boolean,
    "irregularities": string[]
  } | null,
  "electricityBill": {
    "averageMonthlyAmount": number | null
  } | null,
  "siteAssessment": {
    "recommendedSystemSizeKwp": number | null,
    "siteViable": boolean | null,
    "notes": string[]
  } | null,
  "installationQuote": {
    "totalQuoteAmount": number | null,
    "installerName": string | null,
    "systemSizeKwp": number | null
  } | null,
  "generalFlags": string[]
}

Set a top-level key to null if no document of that type was provided or readable.
generalFlags should list any cross-document concerns (e.g. revenue inconsistency between bank statement and financials, mismatched system sizes, missing signatures, suspicious patterns).

DOCUMENTS:
${docsContext}`;

  let insights: DocumentInsights;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5-20251101",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip any accidental markdown fences before parsing
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Omit<DocumentInsights, "documentsSummarized">;
    insights = { ...parsed, documentsSummarized };
  } catch (err: any) {
    console.error("[documentAnalysis] Claude extraction failed:", err?.message ?? err);
    insights = emptyInsights([`AI extraction failed: ${err?.message ?? "unknown"}`]);
    insights.documentsSummarized = documentsSummarized;
  }

  return insights;
}

function emptyInsights(generalFlags: string[]): DocumentInsights {
  return {
    auditedFinancials: null,
    bankStatement: null,
    electricityBill: null,
    siteAssessment: null,
    installationQuote: null,
    generalFlags,
    documentsSummarized: [],
  };
}
