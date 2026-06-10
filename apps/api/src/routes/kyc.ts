import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { verifyBVN, verifyCAC, isKYCConfigured } from "../services/kyc";

const router = Router();
router.use(requireAuth);

const bvnSchema = z.object({
  directorId: z.string(),
  bvn: z.string().length(11),
  dateOfBirth: z.string(),
});

const cacSchema = z.object({
  applicationId: z.string(),
  cacNumber: z.string(),
});

// Verify a single director's BVN
router.post("/bvn", async (req: AuthRequest, res: Response) => {
  const parsed = bvnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { directorId, bvn, dateOfBirth } = parsed.data;

  const director = await prisma.director.findUnique({
    where: { id: directorId },
    include: { business: true },
  });

  if (!director) {
    return res.status(404).json({ success: false, message: "Director not found" });
  }

  const result = await verifyBVN(bvn, dateOfBirth);
  const kycStatus = result.status === "PASSED" ? "PASSED" : result.status === "PENDING" ? "PENDING" : "FAILED";

  await prisma.director.update({
    where: { id: directorId },
    data: { kycStatus, kycReference: result.reference, dateOfBirth },
  });

  await prisma.kYCCheck.create({
    data: {
      businessId: director.businessId,
      checkType: "BVN",
      provider: "dojah",
      reference: result.reference,
      status: kycStatus,
      rawResponse: result.details as any,
      notes: result.message,
    },
  });

  return res.json({ success: true, data: result });
});

// Verify CAC for a single application
router.post("/cac", async (req: AuthRequest, res: Response) => {
  const parsed = cacSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { applicationId, cacNumber } = parsed.data;

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { business: true },
  });

  if (!application) {
    return res.status(404).json({ success: false, message: "Application not found" });
  }

  const result = await verifyCAC(cacNumber);
  const kycStatus = result.status === "PASSED" ? "PASSED" : result.status === "PENDING" ? "PENDING" : "FAILED";

  await prisma.kYCCheck.create({
    data: {
      businessId: application.businessId,
      applicationId,
      checkType: "CAC",
      provider: "dojah",
      reference: result.reference,
      status: kycStatus,
      rawResponse: result.details as any,
      notes: result.message,
    },
  });

  return res.json({ success: true, data: result });
});

// Run all KYC checks for an application (BVN for all directors + CAC)
// Can be called by SME (own app) or analyst
router.post("/run/:applicationId", async (req: AuthRequest, res: Response) => {
  const application = await prisma.loanApplication.findUnique({
    where: { id: req.params.applicationId },
    include: {
      business: { include: { directors: true } },
    },
  });

  if (!application) {
    return res.status(404).json({ success: false, message: "Application not found" });
  }

  // SME can only run on their own application
  if (req.user!.role === "SME_OWNER") {
    const business = await prisma.business.findUnique({ where: { userId: req.user!.userId } });
    if (application.businessId !== business?.id) {
      return res.status(403).json({ success: false, message: "You do not have permission to run KYC for this application." });
    }
  }

  const results: Record<string, any> = {};

  // BVN check for each director
  for (const director of application.business.directors) {
    const dob = director.dateOfBirth || "";
    const result = await verifyBVN(director.bvn, dob);
    const kycStatus = result.status === "PASSED" ? "PASSED" : result.status === "PENDING" ? "PENDING" : "FAILED";

    await prisma.director.update({
      where: { id: director.id },
      data: { kycStatus, kycReference: result.reference },
    });

    await prisma.kYCCheck.create({
      data: {
        businessId: application.businessId,
        applicationId: application.id,
        checkType: "BVN",
        provider: "dojah",
        reference: result.reference,
        status: kycStatus,
        rawResponse: result.details as any,
        notes: result.message,
      },
    });

    results[`bvn_${director.id}`] = { director: `${director.firstName} ${director.lastName}`, ...result };
  }

  // CAC check
  const cacResult = await verifyCAC(application.business.cacNumber);
  const cacStatus = cacResult.status === "PASSED" ? "PASSED" : cacResult.status === "PENDING" ? "PENDING" : "FAILED";

  await prisma.kYCCheck.create({
    data: {
      businessId: application.businessId,
      applicationId: application.id,
      checkType: "CAC",
      provider: "dojah",
      reference: cacResult.reference,
      status: cacStatus,
      rawResponse: cacResult.details as any,
      notes: cacResult.message,
    },
  });

  results.cac = cacResult;

  // Determine overall KYC status
  const allChecks = Object.values(results);
  const anyFailed = allChecks.some((r: any) => r.status === "FAILED");
  const allPassed = allChecks.every((r: any) => r.status === "PASSED");
  const newAppStatus = allFailed(allChecks) ? "KYC_FAILED" : allPassed ? "KYC_VERIFIED" : "KYC_PENDING";

  await prisma.loanApplication.update({
    where: { id: application.id },
    data: { status: newAppStatus as any },
  });

  return res.json({
    success: true,
    configured: isKYCConfigured(),
    status: newAppStatus,
    data: results,
  });
});

function allFailed(results: any[]) {
  return results.every((r: any) => r.status === "FAILED");
}

export default router;
