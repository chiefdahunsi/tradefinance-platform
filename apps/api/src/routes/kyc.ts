import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { verifyBVN, verifyCAC } from "../services/kyc";

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

// Verify a director's BVN
router.post("/bvn", async (req: AuthRequest, res: Response) => {
  const parsed = bvnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { directorId, bvn, dateOfBirth } = parsed.data;

  const director = await prisma.director.findUnique({
    where: { id: directorId },
    include: { business: true },
  });

  if (!director) {
    return res
      .status(404)
      .json({ success: false, message: "Director not found" });
  }

  const result = await verifyBVN(bvn, dateOfBirth);

  await prisma.director.update({
    where: { id: directorId },
    data: {
      kycStatus: result.status === "PASSED" ? "PASSED" : "FAILED",
      kycReference: result.reference,
    },
  });

  await prisma.kYCCheck.create({
    data: {
      businessId: director.businessId,
      checkType: "BVN",
      provider: "dojah",
      reference: result.reference,
      status: result.status === "PASSED" ? "PASSED" : "FAILED",
      rawResponse: result.details as any,
    },
  });

  return res.json({ success: true, data: result });
});

// Verify CAC registration
router.post("/cac", async (req: AuthRequest, res: Response) => {
  const parsed = cacSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { applicationId, cacNumber } = parsed.data;

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { business: true },
  });

  if (!application) {
    return res
      .status(404)
      .json({ success: false, message: "Application not found" });
  }

  const result = await verifyCAC(cacNumber);

  await prisma.kYCCheck.create({
    data: {
      businessId: application.businessId,
      applicationId,
      checkType: "CAC",
      provider: "dojah",
      reference: result.reference,
      status: result.status === "PASSED" ? "PASSED" : "FAILED",
      rawResponse: result.details as any,
    },
  });

  return res.json({ success: true, data: result });
});

export default router;
