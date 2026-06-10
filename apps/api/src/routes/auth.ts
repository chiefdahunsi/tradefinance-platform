import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { authLimiter, registerLimiter } from "../middleware/rate-limit";
import { audit, AuditAction } from "../services/audit";

const router = Router();

const smeRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const analystRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["ANALYST", "ADMIN"]).default("ANALYST"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );
}

// Public — SME self-registration (always creates SME_OWNER)
router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parsed = smeRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password, firstName, lastName, phone } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, phone, role: "SME_OWNER" },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  audit({ entityType: "User", entityId: user.id, action: AuditAction.REGISTER, actorId: user.id, actorEmail: user.email, req });

  return res.status(201).json({ success: true, data: { user, token: signToken(user) } });
});

// Admin-only — provision analyst/admin accounts
router.post(
  "/analyst-register",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const parsed = analystRegisterSchema.safeParse(req.body);
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
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    return res.status(201).json({ success: true, data: { user } });
  }
);

// SME login — rejects non-SME accounts
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    audit({ entityType: "User", entityId: email, action: AuditAction.LOGIN_FAILED, actorEmail: email, req });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (user.role !== "SME_OWNER") {
    return res.status(403).json({
      success: false,
      message: "This portal is for applicants only. Please use the Analyst Portal to sign in.",
    });
  }

  audit({ entityType: "User", entityId: user.id, action: AuditAction.LOGIN_SUCCESS, actorId: user.id, actorEmail: user.email, req });

  return res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token: signToken(user),
    },
  });
});

// Analyst login — rejects SME accounts
router.post("/analyst-login", authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    audit({ entityType: "User", entityId: email, action: AuditAction.LOGIN_FAILED, actorEmail: email, req });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (user.role !== "ANALYST" && user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "This portal is for analysts only. Please use the Applicant Portal to sign in.",
    });
  }

  audit({ entityType: "User", entityId: user.id, action: AuditAction.LOGIN_SUCCESS, actorId: user.id, actorEmail: user.email, req });

  return res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token: signToken(user),
    },
  });
});

export default router;
