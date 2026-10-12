-- AlterEnum
ALTER TYPE "AttendanceMethod" ADD VALUE 'SELF_QR';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "self_checkin_open" BOOLEAN NOT NULL DEFAULT false;
