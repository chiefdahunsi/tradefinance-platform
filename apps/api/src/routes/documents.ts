import { Router, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { Readable } from "stream";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest, requireRole } from "../middleware/auth";
import { sendDocumentRejected } from "../services/email";

const router = Router();

const S3_CONFIGURED =
  !!process.env.AWS_ACCESS_KEY_ID &&
  !!process.env.AWS_SECRET_ACCESS_KEY &&
  !!process.env.S3_BUCKET &&
  process.env.AWS_ACCESS_KEY_ID !== "" &&
  process.env.AWS_SECRET_ACCESS_KEY !== "";

const s3 = S3_CONFIGURED
  ? new S3Client({
      region: process.env.AWS_REGION || "eu-west-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const BUCKET = process.env.S3_BUCKET || "";

// Local upload folder — used only when S3 is not configured
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!S3_CONFIGURED && !fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

if (S3_CONFIGURED) {
  console.log(`[Storage] S3 enabled — bucket: ${BUCKET}`);
} else {
  console.log(`[Storage] S3 not configured — using local storage at ${LOCAL_UPLOAD_DIR}`);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PDF, JPG and PNG files are allowed"));
    }
    cb(null, true);
  },
});

router.use(requireAuth);

// Upload a document for an application
router.post(
  "/:applicationId",
  (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File is too large. Maximum size is 10MB." });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded. Please select a PDF, JPG or PNG file." });
      }

      const { documentType } = req.body;
      if (!documentType) {
        return res.status(400).json({ success: false, message: "Document type is required." });
      }

      const application = await prisma.loanApplication.findUnique({
        where: { id: req.params.applicationId },
        include: { business: true },
      });

      if (!application) {
        return res.status(404).json({ success: false, message: "Application not found." });
      }

      // SMEs can re-upload on DRAFT or when a document was rejected (any non-terminal status)
      if (req.user!.role === "SME_OWNER") {
        const business = await prisma.business.findUnique({ where: { userId: req.user!.userId } });
        if (application.businessId !== business?.id) {
          return res.status(403).json({ success: false, message: "Access denied." });
        }
        const terminalStatuses = ["APPROVED"];
        if (terminalStatuses.includes(application.status)) {
          return res.status(400).json({ success: false, message: "Cannot upload documents to a finalised application." });
        }
      }

      const fileExt = path.extname(req.file.originalname);
      const fileKey = `documents/${application.id}/${uuid()}${fileExt}`;
      let fileUrl: string;

      if (S3_CONFIGURED && s3) {
        // Upload to S3 (private bucket — access via signed URLs)
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            Metadata: {
              applicationId: application.id,
              documentType,
              uploadedBy: req.user!.userId,
              originalName: req.file.originalname,
            },
          })
        );
        // Store the S3 key as the URL — we'll generate signed URLs on demand
        fileUrl = `s3://${BUCKET}/${fileKey}`;
      } else {
        // Local fallback for development
        const localFileName = `${uuid()}${fileExt}`;
        const localPath = path.join(LOCAL_UPLOAD_DIR, localFileName);
        fs.writeFileSync(localPath, req.file.buffer);
        fileUrl = `/uploads/${localFileName}`;
        console.log(`[DEV] File saved locally: ${localPath}`);
      }

      // Delete existing document of the same type (replace)
      const existing = await prisma.document.findFirst({
        where: { applicationId: application.id, type: documentType as any },
      });
      if (existing) {
        // Clean up old file
        if (S3_CONFIGURED && s3 && existing.fileKey) {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: existing.fileKey })).catch(() => {});
        } else if (!S3_CONFIGURED && existing.fileUrl.startsWith("/uploads/")) {
          const oldPath = path.join(process.cwd(), existing.fileUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await prisma.document.delete({ where: { id: existing.id } });
      }

      const document = await prisma.document.create({
        data: {
          applicationId: application.id,
          type: documentType as any,
          fileName: req.file.originalname,
          fileKey,
          fileUrl,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      return res.status(201).json({ success: true, data: document });
    } catch (err: any) {
      console.error("Upload error:", err?.message || err);
      return res.status(500).json({ success: false, message: "File upload failed. Please try again." });
    }
  }
);

// Get a signed download URL (works for both S3 and local)
router.get("/:documentId/url", async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.documentId },
      include: {
        application: {
          include: { business: true },
        },
      },
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found." });
    }

    // SMEs can only access their own documents
    if (req.user!.role === "SME_OWNER") {
      const business = await prisma.business.findUnique({ where: { userId: req.user!.userId } });
      if (doc.application.businessId !== business?.id) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }
    }

    if (S3_CONFIGURED && s3 && doc.fileUrl.startsWith("s3://")) {
      // Generate a 15-minute signed URL
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: doc.fileKey,
          ResponseContentDisposition: `inline; filename="${doc.fileName}"`,
        }),
        { expiresIn: 900 } // 15 minutes
      );
      return res.json({ success: true, data: { url: signedUrl, fileName: doc.fileName } });
    } else {
      // Local dev — return direct path
      return res.json({ success: true, data: { url: `http://localhost:4000${doc.fileUrl}`, fileName: doc.fileName } });
    }
  } catch (err: any) {
    console.error("Signed URL error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Could not generate download link." });
  }
});

// Convert a document to Markdown using markitdown (analyst/admin only)
router.get(
  "/:documentId/markdown",
  requireRole("ANALYST", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const doc = await prisma.document.findUnique({
        where: { id: req.params.documentId },
        include: { application: { include: { business: true } } },
      });

      if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

      // Fetch the file bytes
      let fileBuffer: Buffer;
      if (S3_CONFIGURED && s3 && doc.fileUrl.startsWith("s3://")) {
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileKey }));
        const chunks: Buffer[] = [];
        for await (const chunk of obj.Body as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        fileBuffer = Buffer.concat(chunks);
      } else {
        const localPath = path.join(process.cwd(), doc.fileUrl);
        fileBuffer = fs.readFileSync(localPath);
      }

      // Write to a temp file so markitdown can read it
      const ext = path.extname(doc.fileName) || ".pdf";
      const tmpFile = path.join(os.tmpdir(), `${uuid()}${ext}`);
      fs.writeFileSync(tmpFile, fileBuffer);

      // Run markitdown <tmpFile> and collect stdout
      const markdown = await new Promise<string>((resolve, reject) => {
        let out = "";
        let err = "";
        const proc = spawn("python3", ["-m", "markitdown", tmpFile]);
        proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
        proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
        proc.on("close", (code) => {
          fs.unlink(tmpFile, () => {});
          if (code !== 0) return reject(new Error(err || `markitdown exited with code ${code}`));
          resolve(out);
        });
        proc.on("error", (e) => {
          fs.unlink(tmpFile, () => {});
          reject(e);
        });
      });

      return res.json({
        success: true,
        data: {
          documentId: doc.id,
          fileName: doc.fileName,
          documentType: doc.type,
          markdown,
        },
      });
    } catch (err: any) {
      console.error("[markitdown]", err?.message || err);
      return res.status(500).json({ success: false, message: `Conversion failed: ${err?.message || "unknown error"}` });
    }
  }
);

// Analyst: approve or reject a single document
router.patch(
  "/:documentId/review",
  requireRole("ANALYST", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { status, rejectionReason } = req.body as { status: "APPROVED" | "REJECTED"; rejectionReason?: string };

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be APPROVED or REJECTED" });
    }
    if (status === "REJECTED" && !rejectionReason?.trim()) {
      return res.status(400).json({ success: false, message: "rejectionReason is required when rejecting a document" });
    }

    const doc = await prisma.document.findUnique({
      where: { id: req.params.documentId },
      include: { application: { include: { business: { include: { user: true } } } } },
    });

    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: status as any,
        rejectionReason: status === "REJECTED" ? rejectionReason : null,
        reviewedAt: new Date(),
      },
    });

    if (status === "REJECTED") {
      const { user } = doc.application.business;
      const webUrl = process.env.WEB_URL || "https://padimarket.com.ng";
      sendDocumentRejected({
        to: user.email,
        firstName: user.firstName,
        businessName: doc.application.business.registeredName,
        referenceNumber: doc.application.referenceNumber,
        documentType: doc.type,
        rejectionReason: rejectionReason!,
        dashboardUrl: `${webUrl}/dashboard/applications/${doc.applicationId}`,
      }).catch((err) => console.error("Doc rejection email error:", err));
    }

    return res.json({ success: true, data: updated });
  }
);

export default router;
