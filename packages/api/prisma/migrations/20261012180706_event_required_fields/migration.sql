-- AlterTable
ALTER TABLE "events" ADD COLUMN     "require_career" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_institution" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_phone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_semester" BOOLEAN NOT NULL DEFAULT false;
