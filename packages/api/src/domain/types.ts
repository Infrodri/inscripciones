export type Role = 'ADMIN' | 'STAFF';
export type EventStatus = 'BORRADOR' | 'ABIERTO' | 'CERRADO' | 'FINALIZADO';
export type Modality = 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDO';
export type ParticipantType = 'ESTUDIANTE' | 'DOCENTE' | 'PROFESIONAL' | 'PUBLICO';
export type Source = 'ONLINE' | 'WALK_IN';
export type SpeakerRole = 'EXPOSITOR' | 'MODERADOR';
export type AttendanceMethod = 'QR' | 'MANUAL';
export type RoleKind = 'ASISTENTE' | 'EXPOSITOR' | 'ORGANIZADOR' | 'OTRO';
export type NameAlign = 'left' | 'center' | 'right';
export type NameCase = 'UPPER' | 'TITLE' | 'AS_TYPED';

export interface NameBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  fontKey: 'sans' | 'serif' | 'script';
  sizePt: number;
  color: string;
  align: NameAlign;
  nameCase: NameCase;
  autoShrink: true;
}

export interface EventInput {
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
  modality?: Modality;
  capacity?: number | null;
  registrationDeadline?: Date | null;
  status?: EventStatus;
  isFree?: boolean;
  contactWhatsapp?: string | null;
  issuesCertificate?: boolean;
  minAttendancePercent?: number;
  checkinWindowMinutes?: number;
  createdBy?: string | null;
}
