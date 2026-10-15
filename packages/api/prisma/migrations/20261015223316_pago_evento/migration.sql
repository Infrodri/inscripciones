-- AlterTable
ALTER TABLE "events" ADD COLUMN     "cost" DECIMAL(10,2),
ADD COLUMN     "institution_qr" TEXT;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "payment_proof_url" TEXT;
