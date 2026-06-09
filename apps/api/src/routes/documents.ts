import { Router, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(requireAuth);

// Upload document for an application
router.post(
  "/:applicationId",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded or invalid type" });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res
        .status(400)
        .json({ success: false, message: "documentType is required" });
    }

    const application = await prisma.loanApplication.findUnique({
      where: { id: req.params.applicationId },
      include: { business: true },
    });

    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    const fileKey = `documents/${application.id}/${uuid()}-${req.file.originalname}`;

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
        },
      })
    );

    const fileUrl = `https://${BUCKET}.s3.amazonaws.com/${fileKey}`;

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
  }
);

// Get signed download URL
router.get("/:documentId/download", async (req: AuthRequest, res: Response) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.documentId },
  });

  if (!doc) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: doc.fileKey }),
    { expiresIn: 300 }
  );

  return res.json({ success: true, data: { url } });
});

export default router;
