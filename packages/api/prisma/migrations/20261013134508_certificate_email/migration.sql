-- AlterTable
ALTER TABLE "certificate_recipients" ADD COLUMN     "certificate_email_error" TEXT,
ADD COLUMN     "certificate_emailed_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "certificate_email_body" TEXT,
ADD COLUMN     "certificate_email_subject" TEXT,
ADD COLUMN     "email_certificates" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "certificate_email_error" TEXT,
ADD COLUMN     "certificate_emailed_at" TIMESTAMPTZ;
