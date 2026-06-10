import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "TradeFinance <onboarding@resend.dev>";
const IS_CONFIGURED = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "";

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">TradeFinance</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;">${title}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              This is an automated message from TradeFinance. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:13px;color:#64748b;">${label}</span>
    </td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
      <span style="font-size:13px;font-weight:600;color:#0f172a;">${value}</span>
    </td>
  </tr>`;
}

function btn(text: string, href: string, color = "#16a34a") {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${text}</a>`;
}

async function send(to: string, subject: string, html: string) {
  if (!IS_CONFIGURED) {
    console.log(`[Email skipped — RESEND_API_KEY not set] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err: any) {
    console.error("Email send error:", err?.message || err);
  }
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function sendApplicationSubmitted(opts: {
  to: string;
  firstName: string;
  businessName: string;
  referenceNumber: string;
  amountRequested: number;
  tenor: number;
  commodityType: string;
}) {
  const ref = opts.referenceNumber.slice(0, 8).toUpperCase();
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Dear <strong>${opts.firstName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Your facility application has been received and is currently undergoing KYC verification.
      You will be notified once the review process begins.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${infoRow("Reference", ref)}
      ${infoRow("Business", opts.businessName)}
      ${infoRow("Commodity", opts.commodityType.replace(/_/g, " "))}
      ${infoRow("Amount Requested", `₦${Number(opts.amountRequested).toLocaleString()}`)}
      ${infoRow("Tenor", `${opts.tenor} months`)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      You can track your application status at any time by logging into your dashboard.
    </p>
  `;
  await send(
    opts.to,
    `Application Received — ${ref}`,
    baseTemplate("Application Received", body)
  );
}

export async function sendKYCResult(opts: {
  to: string;
  firstName: string;
  referenceNumber: string;
  passed: boolean;
  details?: string;
}) {
  const ref = opts.referenceNumber.slice(0, 8).toUpperCase();
  const passed = opts.passed;
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Dear <strong>${opts.firstName}</strong>,</p>
    <div style="margin-bottom:20px;padding:16px;border-radius:8px;background:${passed ? "#f0fdf4" : "#fef2f2"};border:1px solid ${passed ? "#bbf7d0" : "#fecaca"};">
      <p style="margin:0;font-size:14px;font-weight:600;color:${passed ? "#15803d" : "#dc2626"};">
        ${passed ? "✓ KYC Verification Passed" : "✕ KYC Verification Issue"}
      </p>
      ${opts.details ? `<p style="margin:6px 0 0;font-size:13px;color:${passed ? "#166534" : "#991b1b"};">${opts.details}</p>` : ""}
    </div>
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
      ${passed
        ? "Your KYC checks have passed. Your application is now in the queue for credit review by our analyst team."
        : "There was an issue with one or more of your KYC checks. Please log in to your dashboard for details or contact support."
      }
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("Reference", ref)}
    </table>
  `;
  await send(
    opts.to,
    `KYC ${passed ? "Passed" : "Issue"} — ${ref}`,
    baseTemplate(`KYC Verification ${passed ? "Passed" : "Update"}`, body)
  );
}

export async function sendDecision(opts: {
  to: string;
  firstName: string;
  businessName: string;
  referenceNumber: string;
  decision: "APPROVED" | "DECLINED" | "MORE_INFO_REQUIRED";
  amountApproved?: number;
  tenorApproved?: number;
  interestRate?: number;
  conditions?: string[];
  notes?: string;
}) {
  const ref = opts.referenceNumber.slice(0, 8).toUpperCase();
  const { decision } = opts;

  const titleMap = {
    APPROVED: "Facility Approved 🎉",
    DECLINED: "Application Update",
    MORE_INFO_REQUIRED: "Additional Information Required",
  };

  const colorMap = {
    APPROVED: "#16a34a",
    DECLINED: "#dc2626",
    MORE_INFO_REQUIRED: "#d97706",
  };

  const bgMap = {
    APPROVED: "#f0fdf4",
    DECLINED: "#fef2f2",
    MORE_INFO_REQUIRED: "#fffbeb",
  };

  const borderMap = {
    APPROVED: "#bbf7d0",
    DECLINED: "#fecaca",
    MORE_INFO_REQUIRED: "#fde68a",
  };

  const messageMap = {
    APPROVED: `Congratulations! Your facility application has been approved. Please review the terms below and contact us to proceed with disbursement.`,
    DECLINED: `After careful review, we are unable to approve your facility application at this time. Please see the notes below for more details.`,
    MORE_INFO_REQUIRED: `Our analyst team requires additional information before a decision can be made on your application. Please log in and check the notes below.`,
  };

  let detailRows = "";
  if (decision === "APPROVED") {
    if (opts.amountApproved) detailRows += infoRow("Amount Approved", `₦${Number(opts.amountApproved).toLocaleString()}`);
    if (opts.tenorApproved) detailRows += infoRow("Tenor Approved", `${opts.tenorApproved} months`);
    if (opts.interestRate) detailRows += infoRow("Interest Rate", `${opts.interestRate}% p.a.`);
  }

  const conditionsHtml = opts.conditions?.length
    ? `<div style="margin-top:20px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Conditions:</p>
        <ul style="margin:0;padding-left:20px;">
          ${opts.conditions.map((c) => `<li style="font-size:13px;color:#475569;margin-bottom:4px;">${c}</li>`).join("")}
        </ul>
      </div>`
    : "";

  const notesHtml = opts.notes
    ? `<div style="margin-top:20px;padding:14px;background:#f8fafc;border-radius:8px;border-left:3px solid #cbd5e1;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Notes from Analyst</p>
        <p style="margin:0;font-size:13px;color:#475569;">${opts.notes}</p>
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Dear <strong>${opts.firstName}</strong>,</p>
    <div style="margin-bottom:20px;padding:16px;border-radius:8px;background:${bgMap[decision]};border:1px solid ${borderMap[decision]};">
      <p style="margin:0;font-size:14px;font-weight:600;color:${colorMap[decision]};">${titleMap[decision]}</p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">${messageMap[decision]}</p>
    ${detailRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${detailRows}</table>` : ""}
    ${conditionsHtml}
    ${notesHtml}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${infoRow("Reference", ref)}
      ${infoRow("Business", opts.businessName)}
    </table>
  `;

  await send(
    opts.to,
    `${titleMap[decision]} — ${ref}`,
    baseTemplate(titleMap[decision], body)
  );
}
