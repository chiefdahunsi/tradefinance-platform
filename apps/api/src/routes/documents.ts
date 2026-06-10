import { Router, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

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

export default router;
