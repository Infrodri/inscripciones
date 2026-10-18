export type Modality = 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDO';

export type EventStatus = 'BORRADOR' | 'ABIERTO' | 'CERRADO' | 'FINALIZADO';

export type ParticipantType = 'ESTUDIANTE' | 'DOCENTE' | 'PROFESIONAL' | 'PUBLICO';

export type RoleKind = 'ASISTENTE' | 'EXPOSITOR' | 'ORGANIZADOR' | 'OTRO';

export interface PublicSession {
  id?: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  label?: string | null;
}

export interface PublicSpeaker {
  id?: string;
  fullName: string;
  titleProfession?: string | null;
  role: 'EXPOSITOR' | 'MODERADOR' | string;
  institution?: string | null;
  photoPath?: string | null;
  position?: number;
}

export interface PublicSponsor {
  id?: string;
  name: string;
  logoPath?: string | null;
  position?: number;
}

export interface PublicEvent {
  slug: string;
  title: string;
  eventKind: string;
  institution: string;
  commemoration?: string | null;
  organizer: string;
  audienceNote?: string | null;
  description?: string | null;
  location: string;
  mapUrl?: string | null;
  modality: Modality;
  capacity?: number | null;
  registrationDeadline?: string | null;
  status: EventStatus;
  isFree: boolean;
  cost?: number | null;
  institutionQr?: string | null;
  contactWhatsapp?: string | null;
  issuesCertificate?: boolean;
  requireCareer?: boolean;
  requireSemester?: boolean;
  requireInstitution?: boolean;
  requirePhone?: boolean;
  bannerUrl?: string | null;
  shareImageUrl?: string | null;
  sessions?: PublicSession[];
  speakers?: PublicSpeaker[];
  sponsors?: PublicSponsor[];
  spotsLeft?: number | null;
  registrationOpen: boolean;
  registrationReason?: string;
}

export interface CertificateVerificationRequest {
  ci: string;
  code: string;
}

export interface CertificateVerificationResponse {
  valid: boolean;
  message?: string;
  eventTitle?: string;
  recipientName?: string;
  roleKind?: RoleKind | string;
  issueDate?: string;
  institution?: string;
}
