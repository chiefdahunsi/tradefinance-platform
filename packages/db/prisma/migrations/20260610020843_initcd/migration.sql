-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SME_OWNER', 'ANALYST', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'KYC_PENDING', 'KYC_VERIFIED', 'KYC_FAILED', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'MORE_INFO_REQUIRED');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CAC_CERTIFICATE', 'CAC_STATUS_REPORT', 'MEMART', 'AUDITED_FINANCIALS', 'BANK_STATEMENT', 'TRADE_CONTRACT', 'INVOICE', 'LETTER_OF_CREDIT', 'WAREHOUSE_RECEIPT', 'DIRECTORS_ID', 'UTILITY_BILL', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommodityType" AS ENUM ('COCOA', 'CASHEW', 'SESAME', 'SOYBEAN', 'PALM_OIL', 'GROUNDNUT', 'COTTON', 'GINGER', 'RUBBER', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'SME_OWNER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registeredName" TEXT NOT NULL,
    "tradingName" TEXT,
    "cacNumber" TEXT NOT NULL,
    "taxId" TEXT,
    "dateIncorporated" TIMESTAMP(3),
    "businessType" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "website" TEXT,
    "commodities" "CommodityType"[],
    "yearsInOperation" INTEGER,
    "annualTurnover" DECIMAL(18,2),
    "exportMarkets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Director" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "bvn" TEXT NOT NULL,
    "nin" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'Nigerian',
    "percentOwned" DECIMAL(5,2) NOT NULL,
    "isSignatory" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "kycReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Director_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "amountRequested" DECIMAL(18,2) NOT NULL,
    "tenor" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "commodityType" "CommodityType" NOT NULL,
    "tradeDescription" TEXT NOT NULL,
    "collateralType" TEXT,
    "collateralValue" DECIMAL(18,2),
    "collateralDetails" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extractedData" JSONB,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KYCCheck" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "applicationId" TEXT,
    "checkType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT,
    "status" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "rawResponse" JSONB,
    "score" INTEGER,
    "notes" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KYCCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditProfile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "scoreGrade" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "kycScore" INTEGER NOT NULL,
    "financialScore" INTEGER NOT NULL,
    "tradeHistoryScore" INTEGER NOT NULL,
    "collateralScore" INTEGER NOT NULL,
    "bureauScore" INTEGER,
    "bureauProvider" TEXT,
    "bureauReference" TEXT,
    "bureauRawData" JSONB,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[],
    "risks" TEXT[],
    "conditions" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "decision" TEXT,
    "amountApproved" DECIMAL(18,2),
    "tenorApproved" INTEGER,
    "interestRate" DECIMAL(5,2),
    "conditions" TEXT[],
    "notes" TEXT,
    "internalNotes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Business_userId_key" ON "Business"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_cacNumber_key" ON "Business"("cacNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_referenceNumber_key" ON "LoanApplication"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditProfile_applicationId_key" ON "CreditProfile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalystReview_applicationId_key" ON "AnalystReview"("applicationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Director" ADD CONSTRAINT "Director_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KYCCheck" ADD CONSTRAINT "KYCCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KYCCheck" ADD CONSTRAINT "KYCCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditProfile" ADD CONSTRAINT "CreditProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystReview" ADD CONSTRAINT "AnalystReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystReview" ADD CONSTRAINT "AnalystReview_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
