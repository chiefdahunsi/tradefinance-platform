import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@tradefinance/db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { audit, AuditAction } from "../services/audit";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

// Platform stats
router.get("/stats", async (_req: AuthRequest, res: Response) => {
  const [
    totalUsers,
    totalSMEs,
    totalAnalysts,
    totalApplications,
    applicationsByStatus,
    totalBusinesses,
    kycPassed,
    kycFailed,
    kycPending,
    recentApplications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "SME_OWNER" } }),
    prisma.user.count({ where: { role: "ANALYST" } }),
    prisma.loanApplication.count(),
    prisma.loanApplication.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.business.count(),
    prisma.kYCCheck.count({ where: { status: "PASSED" } }),
    prisma.kYCCheck.count({ where: { status: "FAILED" } }),
    prisma.kYCCheck.count({ where: { status: "PENDING" } }),
    prisma.loanApplication.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { registeredName: true } },
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of applicationsByStatus) {
    statusMap[row.status] = row._count.id;
  }

  return res.json({
    success: true,
    data: {
      users: { total: totalUsers, sme: totalSMEs, analysts: totalAnalysts },
      applications: {
        total: totalApplications,
        byStatus: statusMap,
      },
      businesses: totalBusinesses,
      kyc: { passed: kycPassed, failed: kycFailed, pending: kycPending },
      recentApplications,
    },
  });
});

// List all users
router.get("/users", async (req: AuthRequest, res: Response) => {
  const { role, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = role ? { role: role as any } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        business: { select: { registeredName: true, cacNumber: true } },
        _count: { select: { analystReviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({ success: true, data: users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

// Get single user
router.get("/users/:id", async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isVerified: true,
      createdAt: true,
      business: {
        include: {
          directors: true,
          applications: {
            include: { creditProfile: true, analystReview: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({ success: true, data: user });
});

// Provision new analyst or admin account
const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["ANALYST", "ADMIN"]),
  password: z.string().min(8),
});

router.post("/users", async (req: AuthRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password, firstName, lastName, phone, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, phone, role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });

  audit({ entityType: "User", entityId: user.id, action: AuditAction.USER_PROVISIONED, actorId: req.user!.userId, changes: { role, email }, req });

  return res.status(201).json({ success: true, data: user });
});

// Update user role
router.patch("/users/:id/role", async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!["SME_OWNER", "ANALYST", "ADMIN"].includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }

  // Prevent admin from demoting themselves
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ success: false, message: "You cannot change your own role" });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  audit({ entityType: "User", entityId: req.params.id, action: AuditAction.USER_ROLE_CHANGED, actorId: req.user!.userId, changes: { role }, req });

  return res.json({ success: true, data: user });
});

// Deactivate / reactivate user
router.patch("/users/:id/verify", async (req: AuthRequest, res: Response) => {
  const { isVerified } = req.body;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isVerified },
    select: { id: true, email: true, firstName: true, lastName: true, isVerified: true },
  });

  return res.json({ success: true, data: user });
});

// Audit log
router.get("/audit-log", async (req: AuthRequest, res: Response) => {
  const { entityType, entityId, page = "1", limit = "50" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: parseInt(limit) }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({ success: true, data: logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

export default router;
