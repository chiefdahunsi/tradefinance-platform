import { prisma } from "@tradefinance/db";
import { Request } from "express";

interface AuditParams {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorEmail?: string;
  changes?: Record<string, any>;
  req?: Request;
}

export async function audit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        changes: params.changes as any,
        ipAddress: params.req
          ? (params.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
            params.req.socket.remoteAddress
          : undefined,
      },
    });
  } catch (err) {
    // Audit failures should never break the main flow
    console.error("Audit log error:", err);
  }
}

// Convenience wrappers
export const AuditAction = {
  // Auth
  LOGIN_SUCCESS: "AUTH:LOGIN_SUCCESS",
  LOGIN_FAILED: "AUTH:LOGIN_FAILED",
  REGISTER: "AUTH:REGISTER",
  LOGOUT: "AUTH:LOGOUT",

  // Application
  APPLICATION_CREATED: "APPLICATION:CREATED",
  APPLICATION_SUBMITTED: "APPLICATION:SUBMITTED",

  // KYC
  KYC_RUN: "KYC:RUN",
  KYC_PASSED: "KYC:PASSED",
  KYC_FAILED: "KYC:FAILED",

  // Documents
  DOCUMENT_UPLOADED: "DOCUMENT:UPLOADED",
  DOCUMENT_REPLACED: "DOCUMENT:REPLACED",

  // Analyst
  APPLICATION_ASSIGNED: "ANALYST:ASSIGNED",
  CREDIT_PROFILE_GENERATED: "ANALYST:CREDIT_PROFILE_GENERATED",
  DECISION_SUBMITTED: "ANALYST:DECISION_SUBMITTED",

  // Admin
  USER_ROLE_CHANGED: "ADMIN:USER_ROLE_CHANGED",
  USER_PROVISIONED: "ADMIN:USER_PROVISIONED",
} as const;
