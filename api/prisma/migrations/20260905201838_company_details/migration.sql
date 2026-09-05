-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyEmail" TEXT,
ADD COLUMN     "companyLegalName" TEXT,
ADD COLUMN     "companyName" TEXT NOT NULL DEFAULT 'PeoplePay360',
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "logoFileId" UUID,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "website" TEXT;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
