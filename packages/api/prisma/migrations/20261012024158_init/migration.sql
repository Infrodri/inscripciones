-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('BORRADOR', 'ABIERTO', 'CERRADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('PRESENCIAL', 'VIRTUAL', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('ESTUDIANTE', 'DOCENTE', 'PROFESIONAL', 'PUBLICO');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('ONLINE', 'WALK_IN');

-- CreateEnum
CREATE TYPE "SpeakerRole" AS ENUM ('EXPOSITOR', 'MODERADOR');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('ASISTENTE', 'EXPOSITOR', 'ORGANIZADOR', 'OTRO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "event_kind" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "commemoration" TEXT,
    "organizer" TEXT NOT NULL,
    "audience_note" TEXT,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "map_url" TEXT,
    "modality" "Modality" NOT NULL DEFAULT 'PRESENCIAL',
    "capacity" INTEGER,
    "registration_deadline" TIMESTAMPTZ,
    "status" "EventStatus" NOT NULL DEFAULT 'BORRADOR',
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "contact_whatsapp" TEXT,
    "issues_certificate" BOOLEAN NOT NULL DEFAULT true,
    "min_attendance_percent" INTEGER NOT NULL DEFAULT 80,
    "checkin_window_minutes" INTEGER NOT NULL DEFAULT 60,
    "banner_path" TEXT,
    "share_image_path" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_path" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speakers" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "title_profession" TEXT,
    "role" "SpeakerRole" NOT NULL,
    "institution" TEXT,
    "photo_path" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "location" TEXT,
    "label" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" "ParticipantType" NOT NULL,
    "institution" TEXT,
    "career" TEXT,
    "semester" TEXT,
    "qr_token" TEXT NOT NULL,
    "certificate_code" TEXT,
    "data_consent_at" TIMESTAMPTZ NOT NULL,
    "source" "Source" NOT NULL DEFAULT 'ONLINE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_by" TEXT,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'QR',
    "voided_at" TIMESTAMPTZ,
    "voided_by" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role_kind" "RoleKind" NOT NULL,
    "name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "width_px" INTEGER NOT NULL,
    "height_px" INTEGER NOT NULL,
    "page_width_mm" DOUBLE PRECISION NOT NULL,
    "page_height_mm" DOUBLE PRECISION NOT NULL,
    "name_box" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_recipients" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role_kind" "RoleKind" NOT NULL,
    "template_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "speaker_id" TEXT,
    "note" TEXT,
    "certificate_code" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "certificate_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_created_by_idx" ON "events"("created_by");

-- CreateIndex
CREATE INDEX "sponsors_event_id_idx" ON "sponsors"("event_id");

-- CreateIndex
CREATE INDEX "speakers_event_id_idx" ON "speakers"("event_id");

-- CreateIndex
CREATE INDEX "sessions_event_id_idx" ON "sessions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_qr_token_key" ON "participants"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "participants_certificate_code_key" ON "participants"("certificate_code");

-- CreateIndex
CREATE INDEX "participants_event_id_idx" ON "participants"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_event_id_ci_key" ON "participants"("event_id", "ci");

-- CreateIndex
CREATE UNIQUE INDEX "participants_event_id_email_key" ON "participants"("event_id", "email");

-- CreateIndex
CREATE INDEX "attendances_participant_id_idx" ON "attendances"("participant_id");

-- CreateIndex
CREATE INDEX "attendances_session_id_idx" ON "attendances"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_participant_id_session_id_key" ON "attendances"("participant_id", "session_id");

-- CreateIndex
CREATE INDEX "certificate_templates_event_id_idx" ON "certificate_templates"("event_id");

-- CreateIndex
CREATE INDEX "certificate_templates_event_id_role_kind_idx" ON "certificate_templates"("event_id", "role_kind");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_recipients_certificate_code_key" ON "certificate_recipients"("certificate_code");

-- CreateIndex
CREATE INDEX "certificate_recipients_event_id_idx" ON "certificate_recipients"("event_id");

-- CreateIndex
CREATE INDEX "certificate_recipients_template_id_idx" ON "certificate_recipients"("template_id");

-- CreateIndex
CREATE INDEX "certificate_recipients_speaker_id_idx" ON "certificate_recipients"("speaker_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_recipients" ADD CONSTRAINT "certificate_recipients_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_recipients" ADD CONSTRAINT "certificate_recipients_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_recipients" ADD CONSTRAINT "certificate_recipients_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_recipients" ADD CONSTRAINT "certificate_recipients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual (ver schema.prisma): sessions.ends_at si existe debe ser mayor que starts_at
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_ends_after_starts_chk"
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- Manual (ver schema.prisma): a lo más UNA plantilla default por (event_id, role_kind)
CREATE UNIQUE INDEX "certificate_templates_one_default_per_role"
  ON "certificate_templates" ("event_id", "role_kind")
  WHERE "is_default" = true;
